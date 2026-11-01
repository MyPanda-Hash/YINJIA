import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const BASE = 'http://localhost:5173'
const PORT = 9502
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-diag2-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ } }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { media: 'print' })
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});localStorage.setItem('mes_locale','zh-CN');localStorage.setItem('mes_init_done','1');'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.qr-sheet')`)) break }
await sleep(2500)
await ev(`document.body.classList.add('approval-printing'); 'ok'`)
await sleep(600)
console.log('--- print 媒体下的链 ---')
console.log(JSON.stringify(await ev(`(() => {
  const el = document.querySelector('.qr-sheet')
  const chain = []
  let n = el
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n)
    chain.push({ cls: (n.className || n.tagName).toString().slice(0, 40), vis: cs.visibility, disp: cs.display, h: Math.round(n.getBoundingClientRect().height) })
    n = n.parentElement
  }
  return chain
})()`), null, 1))
console.log('--- .qr-sheet 自身 ---')
console.log(JSON.stringify(await ev(`(() => {
  const cs = getComputedStyle(document.querySelector('.qr-sheet'))
  return { vis: cs.visibility, disp: cs.display, w: cs.width, h: cs.height, pos: cs.position, overflow: cs.overflow, opacity: cs.opacity }
})()`), null, 1))
ws.close(); edge.kill(); process.exit(0)
