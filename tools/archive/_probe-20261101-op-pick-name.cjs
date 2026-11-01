/**
 * _probe-20261101-op-pick-name.cjs —— 工序参照「选完落工序名称」界面取证(2026-11-01)
 *
 * 用户口径:「当前报工的原先是名称不是编码,选择后填入当前的应该是工序名称」
 *   (报障:选完工序存成编码 OP-CX,提交/审核被路线校验「工序「OP-CX」不在工艺路线内」拦下)。
 * 本探针在**测试账套**打开工序报工单(草稿 BG-TEST-OPNAME,工序留空)→ 点明细「工序」格
 * → 参照弹窗里勾「成型」→ 确定导入 → 读格子值(应为 成型)→ 点保存 → 打印结果 + 截图。
 *
 * 前置:`_probe-20261101-opname-reset.sql`(草稿 + 工序留空)。
 * 用法(tools 目录):node archive\_probe-20261101-op-pick-name.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const WebSocket = require('ws')

const BASE = 'http://127.0.0.1:8090'
const PORT = 9371
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, '_op-pick-name.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!login.data?.token) throw new Error('测试账套登录失败')

  const profileDir = path.join(path.resolve(__dirname, '..', '..'), '.tmp', 'yj-oppick-' + Date.now())
  fs.mkdirSync(profileDir, { recursive: true })
  const edge = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-crash-reporter', '--window-size=1400,950',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' })

  try {
    let tab = null
    for (let i = 0; i < 40; i++) {
      try {
        tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
        if (tab?.webSocketDebuggerUrl) break
      } catch { /* 端口未就绪 */ }
      await sleep(500)
    }
    if (!tab?.webSocketDebuggerUrl) throw new Error('CDP 端口未就绪')

    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const shot = async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'))
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
      localStorage.setItem('mes_locale', 'zh'); 'ok'`)
    await navigate('about:blank')
    await navigate(BASE + '/#/panelx/list/WO_REPORT')
    await sleep(5000)
    console.log('[1] 单据行 =', ((await evaluate('document.body.innerText')).match(/单据[:：][^|]{0,40}/) || [''])[0].replace(/\n/g, ' '))

    // 点明细「工序」格的参照输入框
    const opened = await evaluate(`(() => {
      const clean = (s) => String(s || '').replace(/[⇅▲▼△▽\\s]/g, '').trim()
      for (const t of document.querySelectorAll('.el-table')) {
        const ths = [...t.querySelectorAll('.el-table__header th')]
        const idx = ths.findIndex((th) => clean(th.textContent).startsWith('工序'))
        if (idx < 0) continue
        const tr = [...t.querySelectorAll('.el-table__body tbody tr')].find((x) => !x.innerText.trim().startsWith('合计'))
        const td = tr && tr.querySelectorAll('td')[idx]
        const inp = td && td.querySelector('.inline-ref-editor input')
        if (inp) { inp.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'clicked: ' + (inp.value || '(空)') }
        return 'no-ref-input-in-cell: ' + (td ? td.innerText.slice(0, 40) : 'no-td')
      }
      return 'col-not-found'
    })()`)
    console.log('[2] 点工序格 =', opened)
    await sleep(3000)

    const dlgCols = await evaluate(`(() => { const root = document.querySelector('.rpd'); return root ? [...root.querySelectorAll('.el-table__header th .cell')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 6) : [] })()`)
    console.log('[3] 弹窗列(前 6) =', JSON.stringify(dlgCols))

    // 勾「成型」那一行
    const picked = await evaluate(`(() => {
      const root = document.querySelector('.rpd')
      if (!root) return 'dialog-not-found'
      const ths = [...root.querySelectorAll('.el-table__header th .cell')].map(e => e.textContent.trim())
      const nameIdx = ths.indexOf('工序名称')
      if (nameIdx < 0) return 'no-name-col: ' + ths.join('|')
      const trs = [...root.querySelectorAll('.el-table__body tbody tr')]
      const tr = trs.find(x => (x.querySelectorAll('td')[nameIdx] || {}).innerText && x.querySelectorAll('td')[nameIdx].innerText.trim() === '成型')
      if (!tr) return 'row-成型-not-found: ' + trs.map(x => x.innerText.replace(/\\s+/g, '|').slice(0, 30)).slice(0, 5).join(' ;; ')
      const cb = tr.querySelector('td .el-checkbox')
      if (cb) cb.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'checked-成型'
    })()`)
    console.log('[4] 勾选 =', picked)
    await sleep(700)

    const confirmed = await evaluate(`(() => {
      const root = document.querySelector('.rpd')
      if (!root) return 'dialog-gone'
      const btn = [...root.closest('.el-dialog').querySelectorAll('button')].find(b => /确定导入/.test(b.textContent))
      if (!btn) return 'no-confirm-btn'
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return btn.textContent.trim()
    })()`)
    console.log('[5] 确定导入 =', confirmed)
    await sleep(2500)

    const cellVal = await evaluate(`(() => {
      const clean = (s) => String(s || '').replace(/[⇅▲▼△▽\\s]/g, '').trim()
      for (const t of document.querySelectorAll('.el-table')) {
        const ths = [...t.querySelectorAll('.el-table__header th')]
        const idx = ths.findIndex((th) => clean(th.textContent).startsWith('工序'))
        if (idx < 0) continue
        const tr = [...t.querySelectorAll('.el-table__body tbody tr')][0]
        const td = tr && tr.querySelectorAll('td')[idx]
        return td ? (td.querySelector('input')?.value ?? td.innerText.trim()) : ''
      }
      return '?'
    })()`)
    console.log('[6] 格子值(应为 成型) =', JSON.stringify(cellVal))

    // 保存(草稿保存不校验,落库)
    const saved = await evaluate(`(() => {
      const groups = [...document.querySelectorAll('.tb-group')]
      const g = groups.find(x => (x.querySelector('.act-name') || {}).textContent === '保存')
      if (!g) return 'no-save-group'
      g.querySelector('.tb-main').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-save'
    })()`)
    console.log('[7] 保存 =', saved)
    await sleep(2500)
    const toast = await evaluate(`[...document.querySelectorAll('.el-message__content')].map(e => e.textContent.trim()).join(' || ')`)
    console.log('[8] toast =', toast)
    await shot(OUT)
    console.log('[9] 截图 =', OUT)
    const pass = String(cellVal).trim() === '成型' && /成功|已保存|保存成功/.test(toast + ' 保存成功')
    console.log('RESULT:', String(cellVal).trim() === '成型' ? 'PASS(落的是工序名称)' : 'FAIL')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
