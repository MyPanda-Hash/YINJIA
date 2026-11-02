import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const BASE = 'http://localhost:5173'
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-i18n-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ } }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map(); const logs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  if (m.method === 'Runtime.consoleAPICalled') logs.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200))
}
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});localStorage.setItem('mes_locale','ja');localStorage.setItem('mes_init_done','1');'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.doc-select-rail')`)) break }
await sleep(5000)
console.log(JSON.stringify(await ev(`(() => {
  const g = window.__i18n || null
  return { hasGlobal: !!g }
})()`)))
console.log('locale=', await ev(`document.querySelector('.dsr-title')?.innerText`))
console.log('console logs:', JSON.stringify(logs.filter((l) => /i18n|locale|语言/i.test(l)).slice(0, 8)))
ws.close(); edge.kill(); process.exit(0)
