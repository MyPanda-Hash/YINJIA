/** _walk-printcheck.cjs — 打印态样式验证:页签条隐藏 / 区条去背景 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9353
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-prn-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  // 切到检验项目及标准页(有 4. 区条),再切物料页看 5. 区条——两页都在 DOM
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`); await sleep(800)
  // 进入打印态:仿真 print 媒体 + 加 approval-printing 类
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  await evaluate(`document.body.classList.add('approval-printing'); 'ok'`)
  await sleep(800)
  const res = await evaluate(`(() => {
    const gs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : 'NO_EL' }
    const bars = [...document.querySelectorAll('.rs-sectionbar')].filter((b) => b.textContent.includes('4.') || b.textContent.includes('5.'))
    return {
      pageTabsDisplay: gs('.rsp-pages', 'display'),
      typeTabsDisplay: gs('.rsp-type-tabs', 'display'),
      bar4_5: bars.map((b) => ({ text: b.textContent.trim().slice(0, 16), bg: getComputedStyle(b).backgroundColor })),
      addBtnDisplay: gs('.rs-add', 'display'),
      sheetVisible: gs('.rsp-sheet', 'visibility'),
    }
  })()`)
  console.log('PRINT: ' + JSON.stringify(res, null, 1))
  await send('Emulation.setEmulatedMedia', { media: '' })
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
