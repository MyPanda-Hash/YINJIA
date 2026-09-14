/** _walk-widthcheck.cjs — 成型配方横向对齐核验:报告头/产品基本信息/配方表/配料要求 各块宽度 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PC = process.argv[2] || 'RD_MOLD_FORMULA'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-wc-'))
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
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/' + PC }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  const m = await evaluate(`(() => {
    const out = []
    for (const t of document.querySelectorAll('.rs-t')) {
      const r = t.getBoundingClientRect()
      out.push({ w: Math.round(r.width), x: Math.round(r.left), cls: [...t.classList].filter(c => c !== 'rs-t').join('.') || 'plain' })
    }
    const add = document.querySelector('.rs-add')
    if (add) out.push({ w: Math.round(add.getBoundingClientRect().width), cls: 'rs-add' })
    const widths = out.map(o => o.w)
    return { blocks: out, allEqual: widths.every(w => w === widths[0]) }
  })()`)
  console.log(JSON.stringify(m, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
