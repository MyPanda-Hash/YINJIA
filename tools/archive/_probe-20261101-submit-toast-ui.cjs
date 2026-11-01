/**
 * _probe-20261101-submit-toast-ui.cjs —— 提交审批时弹「报工缺少唯一工单行锚点」的界面取证(2026-11-01)
 *
 * 用户口径:「这个需要在提交审批处来进行校验而不是点击审批通过的时候出现校验」
 *   (用户截图:点「审批通过」时弹红条「报工缺少唯一工单行锚点(请先选择工单号+工单行号),不能审核」)。
 * 本探针在**测试账套**(token 带 factory=YJ_TEST)打开工序报工单(测试库只有 5 张单,坏草稿 BG-TEST-ANCHOR
 * 就是第一张)→ 工具栏「审批 ▼」→「提交审批」→ 截图 + 读 el-message 文案。
 *
 * 前置:tools/archive/_probe-20261101-anchor-reset.sql(缺行锚点的草稿)。
 * 用法(tools 目录):node archive\_probe-20261101-submit-toast-ui.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const WebSocket = require('ws')

const BASE = 'http://127.0.0.1:8090'
const PORT = 9367
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, '_submit-anchor-toast.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!login.data?.token) throw new Error('测试账套登录失败: ' + JSON.stringify(login).slice(0, 200))

  const profileDir = path.join(path.resolve(__dirname, '..', '..'), '.tmp', 'yj-submit-toast-' + Date.now())
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

    const head = await evaluate(`document.body.innerText.slice(0, 900)`)
    const docLine = (head.match(/单据[:：][^|]{0,40}/) || [''])[0]
    console.log('[1] 当前单据行 =', docLine.replace(/\n/g, ' '), '| 标题 =', await evaluate('document.title'))

    // 工具栏「审批」组:主按钮 + ▼(tb-caret)展开 tb-menu,下拉项是 .ctx-item
    // 工具栏「审批」组:主按钮 = 该组第一个动作(草稿态 = 提交审批),▼ 展开的是其余动作
    const opened = await evaluate(`(() => {
      const groups = [...document.querySelectorAll('.tb-group')]
      const g = groups.find(x => x.querySelector('.act-name') && x.querySelector('.act-name').textContent.trim() === '审批')
      if (!g) return 'no-approval-group: ' + groups.map(x => (x.querySelector('.act-name') || {}).textContent || '').join('|')
      const main = g.querySelector('.tb-main')
      main.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-approval-main(disabled=' + main.classList.contains('disabled') + ')'
    })()`)
    console.log('[2] 点审批主按钮 =', opened)
    await sleep(900)

    // 提交审批有二次确认弹窗(「提交审批确认单据：… 取消 / 确认提交审批」)→ 点确认
    const confirm = await evaluate(`(() => {
      const box = [...document.querySelectorAll('.el-message-box')].find(e => e.offsetParent !== null)
      if (!box) return 'no-confirm-box'
      const btn = [...box.querySelectorAll('button')].find(b => /确认提交审批|确定/.test(b.textContent))
      if (!btn) return 'no-confirm-btn: ' + box.innerText.replace(/\\n+/g, '|').slice(0, 120)
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-confirm'
    })()`)
    console.log('[3] 确认提交审批 =', confirm)
    const clicked = confirm
    console.log('[4] 点提交审批 =', clicked)
    await sleep(1800)

    const toast = await evaluate(`[...document.querySelectorAll('.el-message__content')]
      .filter(e => e.offsetParent !== null).map(e => e.textContent.trim()).join(' || ')`)
    console.log('[5] toast =', toast)
    console.log('[5b] 页面含锚点文案 =', await evaluate(`document.body.innerText.includes('唯一工单行锚点')`))
    await shot(OUT)
    console.log('[6] 截图 =', OUT)
    console.log('RESULT:', toast.includes('唯一工单行锚点') && toast.includes('不能提交审批') ? 'PASS' : 'FAIL')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })





