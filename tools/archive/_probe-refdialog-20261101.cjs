/**
 * _probe-refdialog-20261101.cjs —— 工序报工单「工序」参照弹窗取证(2026-11-01)
 *
 * 用户报障:「当前工序报工单的选择为什么会这样，只有备注列」
 *   (截图:标题「工序 · 参照选择」,表格只有一列「备注」,10 行全空)
 * 根因:`engine.refColumns → pickRefColumns` 无条件优先 `dataSchema.fields`,而**档案(archive)面板**
 *   的 dataSchema 按规范 §八 恒为占位 [{dataName:'备注'}];参照行却是 queryRefRows 的 singleDoc
 *   分支展平后的明细行 ⇒ 只剩一列「备注」且全空。修复见 frontend/src/core/ref/refColumns.js。
 *
 * 本探针:打开 8090 的工序报工单(WO_REPORT)列表页 → 选中单据 → 点明细行「工序」参照格
 *   → 读弹窗列头/行值 + 截图,作为修复前后对照证据。
 *
 * 用法(tools 下):
 *   node archive\_probe-refdialog-20261101.cjs                    # 自己拉 Edge(需 --no-sandbox)
 *   $env:CDP_PORT=9363; node archive\_probe-refdialog-20261101.cjs  # 附着到外部已起的 Edge
 * 截图输出:archive\_refdialog-op-1-page.png / -2-dialog.png
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const WebSocket = require('ws')

const BASE = process.env.PROBE_BASE || process.argv[2] || 'http://127.0.0.1:8090'
const OUT = path.join(__dirname, '_refdialog-op')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const user = login.data.user

  let edge = null
  let profileDir = null
  const PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : 9357
  if (!process.env.CDP_PORT) {
    // 浏览器 profile 放仓库 .tmp(工作区内可写):放 %TEMP% 时 Edge 的网络沙箱授权会 ACL 拒绝而崩
    profileDir = path.join(path.resolve(__dirname, '..', '..'), '.tmp', 'yj-refdlg-' + Date.now())
    fs.mkdirSync(profileDir, { recursive: true })
    edge = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
      '--disable-crash-reporter', '--window-size=1400,950',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' })
  }

  try {
    // 等 CDP 端口就绪(冷启动可达数秒)
    let tab = null
    for (let i = 0; i < 40; i++) {
      try {
        tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
        if (tab && tab.webSocketDebuggerUrl) break
      } catch { /* 端口未 ready */ }
      await sleep(500)
    }
    if (!tab || !tab.webSocketDebuggerUrl) throw new Error('CDP 端口未就绪')

    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) throw new Error('evaluate: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
      return r.result?.result?.value
    }
    const shot = async (suffix) => {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      const f = OUT + '-' + suffix + '.png'
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 80; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } }
    }
    await send('Page.enable'); await send('Runtime.enable')

    // ── 登录(注入 token)+ 打开工序报工单列表 ──
    await navigate(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_locale', 'zh'); 'ok'`)
    await navigate('about:blank')
    await navigate(BASE + '/#/panelx/list/WO_REPORT')
    await sleep(5000)
    console.log('[1] title =', await evaluate('document.title'))
    console.log('[1] 表格 =', JSON.stringify(await evaluate(`[...document.querySelectorAll('.el-table')].map(t => [...t.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 14))`)))
    console.log('[1] 参照编辑框 =', await evaluate(`document.querySelectorAll('.inline-ref-editor input').length`))
    console.log('[1] 页签 =', JSON.stringify(await evaluate(`[...document.querySelectorAll('.el-tabs__item')].map(e => e.textContent.trim()).slice(0, 10)`)))
    console.log('[1] 首屏截图 =', await shot('1-page'))

    // ── 若没有明细参照格:先选中一张单据(点主列表第一行) ──
    let refCount = await evaluate(`document.querySelectorAll('.inline-ref-editor input').length`)
    if (!refCount) {
      const clicked = await evaluate(`(() => {
        const tr = document.querySelector('.el-table__body tbody tr')
        if (!tr) return 'no-row'
        tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return tr.innerText.replace(/\\s+/g, ' ').slice(0, 80)
      })()`)
      console.log('[2] 点选单据行 =', clicked)
      await sleep(4000)
      refCount = await evaluate(`document.querySelectorAll('.inline-ref-editor input').length`)
      console.log('[2] 参照编辑框(选单后) =', refCount)
      console.log('[2] 选单后截图 =', await shot('2-selected'))
    }

    // ── 找到「工序」列的参照格并点开 ──
    const opened = await evaluate(`(() => {
      const clean = (s) => String(s || '').replace(/[⇅▲▼△▽\\s]/g, '').trim()
      const tables = [...document.querySelectorAll('.el-table')]
      for (const t of tables) {
        const ths = [...t.querySelectorAll('.el-table__header th')]
        const idx = ths.findIndex(th => clean(th.textContent).startsWith('工序'))
        if (idx < 0) continue
        const rows = [...t.querySelectorAll('.el-table__body tbody tr')]
        for (const tr of rows) {
          const td = tr.querySelectorAll('td')[idx]
          const inp = td && td.querySelector('.inline-ref-editor input')
          if (inp) { inp.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'clicked:' + idx + ':' + (inp.value || '(空)') }
        }
        return 'th-found-no-ref-cell:' + idx
      }
      return 'not-found'
    })()`)
    console.log('[3] 点工序参照格 =', opened)
    await sleep(3500)

    // ── 读参照弹窗:标题 / 列头 / 行数 / 首行值 ──
    const dlg = await evaluate(`(() => {
      const root = document.querySelector('.rpd')
      if (!root) return { found: false }
      const box = root.closest('.el-dialog') || root
      const title = (box.querySelector('.el-dialog__title') || {}).textContent || ''
      const cols = [...root.querySelectorAll('.el-table__header th .cell')].map(e => e.textContent.trim()).filter(Boolean)
      const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
      const first = rows[0] ? [...rows[0].querySelectorAll('td .cell')].map(e => e.textContent.trim()) : []
      const tip = (root.querySelector('.rpd-tip') || {}).textContent || ''
      return { found: true, title: title.trim(), cols, rowCount: rows.length, firstRow: first, tip: tip.trim() }
    })()`)
    console.log('[4] 参照弹窗 =', JSON.stringify(dlg, null, 0))
    console.log('[4] 弹窗截图 =', await shot('3-dialog'))

    const pass = !!(dlg.found && dlg.cols.length >= 3 && dlg.cols.includes('工序编码') && dlg.cols.includes('工序名称') && dlg.rowCount > 0)
    console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    ws.close()
  } finally {
    if (edge) edge.kill()
    if (profileDir) { try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {} }
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
