/** _walk-signprint.cjs — 签名表几何 + 打印适配核验(屏显高度/打印 zoom 后高度 ≤ 一页 1062px) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9354
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sgn-'))
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
  const screen = await evaluate(`(() => {
    const page = document.querySelector('.rsp-cover-page')
    const sign = document.querySelector('.rsp-sign-t')
    const pr = page.getBoundingClientRect(); const sr = sign.getBoundingClientRect()
    return { coverH: Math.round(pr.height), signTop: Math.round(sr.top - pr.top), signH: Math.round(sr.height), signBottomInCover: Math.round(sr.bottom - pr.top), fits: (sr.bottom - pr.top) <= pr.height }
  })()`)
  console.log('SCREEN: ' + JSON.stringify(screen))
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  await evaluate(`document.body.classList.add('approval-printing'); 'ok'`)
  await sleep(600)
  const print = await evaluate(`(() => {
    const sheet = document.querySelector('.rsp-sheet')
    const zoom = getComputedStyle(sheet).zoom
    const pr = sheet.getBoundingClientRect()
    const printableH = Math.round((297 - 16) / 25.4 * 96) // 8mm 上下页边距
    return { zoom, printedSheetH: Math.round(pr.height), printableH, fitsOnePage: pr.height <= printableH + 2 }
  })()`)
  console.log('PRINT: ' + JSON.stringify(print))
  await send('Emulation.setEmulatedMedia', { media: '' })
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
