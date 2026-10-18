import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-nav-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9399', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', 'about:blank'],
  { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9399/json/list')).json()
    const p = l.find((t) => t.type === 'page')
    if (p) {
      ws = new WebSocket(p.webSocketDebuggerUrl)
      await new Promise((a, b) => { ws.onopen = a; ws.onerror = b })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
      break
    }
  } catch { /* retry */ }
  await sleep(500)
}
const send = (m, p) => { const i = ++id; return new Promise((r) => { pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: HOST + '/#/login' }); await sleep(4500)
const lg = await (await fetch(HOST + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});'ok'`)
console.log('token after set:', await ev(`localStorage.getItem('mes_token') ? 'present' : 'MISSING'`))

await send('Page.navigate', { url: HOST + '/#/panelx/list/STOCK_LEDGER' })
await sleep(10000)
console.log('after full navigate -> hash:', await ev('location.hash'))
console.log('  token:', await ev(`localStorage.getItem('mes_token') ? 'present' : 'MISSING'`))
console.log('  dialogs:', await ev(`document.querySelectorAll('.el-dialog').length`))

// 对照:先 reload 再改 hash
await send('Page.navigate', { url: HOST + '/#/dashboard' }); await sleep(3000)
await send('Page.reload', { ignoreCache: false }); await sleep(9000)
console.log('after reload -> hash:', await ev('location.hash'))
await ev(`location.hash = '#/panelx/list/STOCK_LEDGER'; 'ok'`)
await sleep(10000)
console.log('after hash nav -> hash:', await ev('location.hash'), 'dialogs:', await ev(`document.querySelectorAll('.el-dialog').length`))

try { edge.kill() } catch { /* ignore */ }
process.exit(0)
