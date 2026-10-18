import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-sw2-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9415', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9415/json/list')).json()
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

const st = () => ev(`(() => {
  const vis = (el) => { const cs=getComputedStyle(el); const ov=el.closest('.el-overlay');
    return cs.display!=='none' && (ov?getComputedStyle(ov).display!=='none':true) && el.offsetParent!==null }
  const all=[...document.querySelectorAll('.el-dialog')]; const v=all.filter(vis)
  return { 可见查询: v.filter(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询').length,
           可见全部: v.length, 标题: v.map(d=>(d.querySelector('.el-dialog__title')?.innerText||'').trim()),
           节点: all.length, hash: location.hash }
})()`)

// 1) 进台账,弹窗开着
await ev(`location.hash='#/panelx/list/STOCK_LEDGER';'ok'`); await sleep(10000)
console.log('1 台账(弹窗开着):', JSON.stringify(await st()))

// 2) 弹窗不关,直接切到汇总
await ev(`location.hash='#/panelx/list/STOCK_SUMMARY';'ok'`)
for (let i = 1; i <= 4; i++) { await sleep(2000); console.log(`2 切汇总 +${i*2}s:`, JSON.stringify(await st())) }

// 3) 切回台账
await ev(`location.hash='#/panelx/list/STOCK_LEDGER';'ok'`)
for (let i = 1; i <= 4; i++) { await sleep(2000); console.log(`3 切回台账 +${i*2}s:`, JSON.stringify(await st())) }

// 4) 刷新页面(用户在面板页按 F5 的路径)
await send('Page.reload', { ignoreCache: false }); await sleep(11000)
console.log('4 面板页 F5 后:', JSON.stringify(await st()))

try { edge.kill() } catch {}
process.exit(0)
