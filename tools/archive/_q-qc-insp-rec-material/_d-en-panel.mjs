/* _d-en-panel.mjs — 调试:切 en 后打开 QC_INSP_REC,看侧栏按钮文案与纸面是否就绪 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const PORT = 9366
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5173').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-en-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const raw = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${APP}/#/login` }); await sleep(3000)
await raw(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','en'); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(500)
await send('Page.navigate', { url: `${APP}/#/panelx/list/QC_INSP_REC` }); await sleep(9000)
console.log('locale =', await raw(`localStorage.getItem('mes_locale')`))
console.log('sheet  =', await raw(`!!document.querySelector('.qc-rec-sheet')`))
console.log('side   =', JSON.stringify(await raw(`[...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g,''))`)))
console.log('body头 =', await raw(`document.body.innerText.replace(/\\s+/g,' ').slice(0, 400)`))
console.log('cell物料名称 =', JSON.stringify(await raw(`(() => { const th=[...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t=>t.innerText.trim()==='物料名称')||[...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')][0]; return th? th.innerText.trim():'' })()`)))
ws.close(); edge.kill()
