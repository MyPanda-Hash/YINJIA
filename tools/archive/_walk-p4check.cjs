/** _walk-p4check.cjs — 规格书第4页(成品及包装运输)块顺序验证:5.关键物料列表 应在 6-8 章节行之上 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-p4-'))
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(700)
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][3]; if (t) t.click(); return 1 })()`)
  await sleep(1000)
  const order = await evaluate(`(() => {
    // 可见页的块顺序:取所有区块级元素,记录 5.物料表 bar 与 6-8 章节行的出现先后
    const marks = []
    const bar = [...document.querySelectorAll('.rs-sectionbar')].find((b) => b.textContent.includes('5.') || b.textContent.includes('Key Material'))
    if (bar) marks.push({ i: marks.length, kind: 'bar5', top: Math.round(bar.getBoundingClientRect().top) })
    for (const c of [...document.querySelectorAll('.rsp-doccell')]) {
      const t = c.textContent.trim().slice(0, 8)
      if (/^[678]\./.test(t) || /Packaging|Shipping|Storage/.test(t)) marks.push({ i: marks.length, kind: t, top: Math.round(c.getBoundingClientRect().top) })
    }
    marks.sort((a, b) => a.top - b.top)
    return marks
  })()`)
  console.log('PAGE4 ORDER: ' + JSON.stringify(order))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
