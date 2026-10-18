import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-close2-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9405', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9405/json/list')).json()
    const p = l.find((t) => t.type === 'page')
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b }); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }; break }
  } catch { /* retry */ }
  await sleep(500)
}
const send = (m, p) => { const i = ++id; return new Promise((r) => { pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: HOST + '/#/login' }); await sleep(4500)
const lg = await (await fetch(HOST + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await send('Page.navigate', { url: HOST + '/#/dashboard' }); await sleep(2500)
await send('Page.reload', { ignoreCache: false }); await sleep(9000)

const deep = () => ev(`(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find(x => (x.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询')
  if (!d) return { none: true }
  const ov = d.closest('.el-overlay')
  return {
    overlayStyle: ov ? (ov.getAttribute('style')||'') : '(none)',
    hasActiveLine: !!d.querySelector('.query-active-cond'),
    activeText: (d.querySelector('.query-active-text')?.innerText || '').slice(0, 80),
    dateVals: [...d.querySelectorAll('.el-date-editor input')].map(i=>i.value),
  }
})()`)

await ev(`location.hash='#/panelx/list/STOCK_SUMMARY';'ok'`); await sleep(12000)
console.log('进入后 deep:', JSON.stringify(await deep()))
await ev(`(() => { const q=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null && (d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询'); [...q.querySelectorAll('button')].find(b=>b.innerText.trim()==='查询').click(); return 1 })()`)
for (let i = 1; i <= 4; i++) {
  await sleep(1500)
  console.log(`+${i * 1.5}s deep:`, JSON.stringify(await deep()), 'rows=', await ev(`document.querySelectorAll('.el-table__body tbody tr').length`))
}
try { edge.kill() } catch {}
process.exit(0)
