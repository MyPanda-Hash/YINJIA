import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'http://127.0.0.1:8090'
const prof = mkdtempSync(join(tmpdir(), 'edge-pq-'))
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--remote-debugging-port=9401', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })
let ws, id = 0
const pend = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:9401/json/list')).json()
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
const lg = await (await fetch(HOST + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});localStorage.setItem('mes_locale','zh-CN');'ok'`)
await ev(`localStorage.setItem('mes_query_plans_STOCK_LEDGER', JSON.stringify([{name:'E2E',condition:{仓库:'成品B仓',存货:'PP复合阻垢炭棒/滤芯',_whCode:'CP-02',_itemCode:'A-48-19'},advFilters:[],updatedAt:'x'}]));'ok'`)
await send('Page.navigate', { url: HOST + '/#/dashboard' }); await sleep(2500)
await send('Page.reload', { ignoreCache: false }); await sleep(9000)

await ev(`location.hash='#/panelx/list/STOCK_LEDGER';'ok'`); await sleep(11000)
// 方案维护 → 调用
await ev(`(() => { const q=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null); [...q.querySelectorAll('button')].find(b=>b.innerText.trim()==='方案维护').click(); return 1 })()`)
await sleep(1500)
await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null && /方案维护/.test(x.querySelector('.el-dialog__title')?.innerText||'')); [...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='调用').click(); return 1 })()`)
await sleep(1500)

const before = Date.now()
await ev(`(() => { const q=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null && (d.querySelector('.el-dialog__title')?.innerText||'').trim()==='查询'); [...q.querySelectorAll('button')].find(b=>b.innerText.trim()==='查询').click(); return 1 })()`)
for (let i = 1; i <= 8; i++) {
  await sleep(1000)
  const st = await ev(`(() => {
    const all=[...document.querySelectorAll('.el-dialog')]
    return all.map(d => {
      const cs=getComputedStyle(d); const ov=d.closest('.el-overlay')
      return { title:(d.querySelector('.el-dialog__title')?.innerText||'').trim(),
        disp:cs.display, vis:cs.visibility, ovDisp: ov?getComputedStyle(ov).display:'-',
        off: d.offsetParent===null, style:(ov?ov.getAttribute('style'):'') || '' }
    })
  })()`)
  console.log(`t=${i}s rows=` + (await ev(`document.querySelectorAll('.el-table__body tbody tr').length`)) + ' dialogs=' + JSON.stringify(st))
}
try { edge.kill() } catch {}
process.exit(0)
