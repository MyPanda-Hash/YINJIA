/** _walk-clickdbg.cjs — 调试 realClick 表达式为何取不到元素 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9350
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return { value: r.result?.result?.value, err: r.result?.exceptionDetails ? JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 300) : null, raw: r.result?.result ? undefined : JSON.stringify(r.result).slice(0, 200) } }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(700)
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`); await sleep(900)

  const expr = `[...document.querySelectorAll('.rsp-doccell')].find((c) => c.textContent.includes('1.适用范围'))`
  const probe1 = await evaluate(`(() => { const el = ${expr}; return el ? 'FOUND' : 'MISS' } )()`)
  console.log('probe1: ' + JSON.stringify(probe1))
  const probe2 = await evaluate(`(() => {
      const el = ${expr}
      if (!el) return null
      const r = el.getBoundingClientRect()
      const label = el.querySelector('.rsp-doclabel')
      const lr = label ? label.getBoundingClientRect() : null
      const x = 'input' && lr ? (lr.right + r.right) / 2 : (r.left + r.right) / 2
      return { x: Math.round(x), y: Math.round((r.top + r.bottom) / 2), w: Math.round(r.width), h: Math.round(r.height) }
    })()`)
  console.log('probe2(multiline): ' + JSON.stringify(probe2))
  const probe3 = await evaluate(`(() => { const cells = [...document.querySelectorAll('.rsp-doccell')]; return { n: cells.length, texts: cells.map((c) => c.textContent.trim().slice(0, 12)) } })()`)
  console.log('probe3: ' + JSON.stringify(probe3))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
