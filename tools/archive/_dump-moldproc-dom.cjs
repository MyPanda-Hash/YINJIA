/** 一次性排查:页1 的真实 DOM 结构(行/格/控件),用来把探针 helper 写对 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9337
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
  await send('Page.enable'); await send('Runtime.enable')
  await nav(`${FRONT}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank'); await nav(`${FRONT}/#/panelx/list/RD_MOLD_PROC`); await sleep(2500)
  // 新增一张草稿
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
  await sleep(2500)
  await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
    for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()==='成型工艺清单'){ ts[i].click(); return 1 } } return 0 })()`)
  await sleep(1500)
  const dump = await ev(`(function(){ var rs=document.querySelector('.record-sheet'); if(!rs) return 'NO_SHEET'
    var secIdx=0, out=[]
    ;[].slice.call(rs.querySelectorAll('tr')).forEach(function(tr, i){
      var cls=tr.className||''
      if(tr.querySelector('.rs-sectionbar')) out.push('=== 区段条: ' + (tr.textContent||'').trim().replace(/\\s+/g,' '))
      var cells=[].slice.call(tr.querySelectorAll('td,th')).map(function(td, ci){
        var kinds=[]
        if(td.querySelector('.rs-ref-ctl')) kinds.push('REF')
        if(td.querySelector('.el-select')) kinds.push('SELECT')
        if(td.querySelector('input:not([type=hidden])')) kinds.push('INPUT')
        if(td.querySelector('textarea')) kinds.push('TEXTAREA')
        var t=(td.textContent||'').trim().replace(/\\s+/g,' ').slice(0, 18)
        return ci + ':' + (kinds.join('+')||'-') + (td.getAttribute('colspan')?('cs'+td.getAttribute('colspan')):'') + (td.getAttribute('rowspan')?('rs'+td.getAttribute('rowspan')):'') + (t?('«'+t+'»'):'')
      })
      if(cells.length) out.push('tr' + i + ' [' + cls.split(' ').filter(function(c){return c.indexOf('rs-')===0}) .join(',') + '] ' + cells.join(' | '))
    })
    return out.join('\\n') })()`)
  fs.writeFileSync(path.join(__dirname, '_dom-moldproc-p1.txt'), String(dump), 'utf8')
  console.log('已写 tools/archive/_dom-moldproc-p1.txt,行数', String(dump).split('\n').length)
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
