/** 排查 3:三个页签各自可见的区段(用于确定填值范围) */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9339
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom3-'))
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
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
  await sleep(2500)
  const probe = `(function(){ var out={}
    out.visibleSections=[]
    ;[].slice.call(document.querySelectorAll('.record-sheet .rs-sectionbar')).forEach(function(b){
      if(b.offsetParent) out.visibleSections.push(b.textContent.trim().replace(/\\s+/g,' ').slice(0,40)) })
    out.visibleRows = [].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(t){return t.offsetParent}).length
    out.totalRows = document.querySelectorAll('.record-sheet tr').length
    out.visAddBtnOwner = (function(){ var b=null
      ;[].slice.call(document.querySelectorAll('.record-sheet button.rs-add')).forEach(function(x){ if(x.offsetParent) b=x })
      if(!b) return 'NONE'
      var tr=b.closest('tr');
      // 找到该行上方最近的区段条文字
      var p=tr, sec='?'
      while(p){ var prev=p.previousElementSibling; while(prev){ var sb=prev.querySelector?prev.querySelector('.rs-sectionbar'):null; if(sb){ sec=sb.textContent.trim().slice(0,20); break } prev=prev.previousElementSibling } if(sec!=='?') break; p=p.parentElement }
      return sec })()
    out.visibleLabels = (function(){ var names=['炭棒编号','理论最低灌料重量g','实际灌料重量计算公式','最短长度mm','炭棒外径mm','压降','配料要求','烧结炉参数','配方表']
      var res={}
      ;[].slice.call(document.querySelectorAll('.record-sheet tr')).forEach(function(tr){
        if(!tr.offsetParent) return
        var txt=tr.textContent.replace(/\\s+/g,' ')
        names.forEach(function(n){ if(txt.indexOf(n)>=0){ (res[n]=res[n]||[]).push(tr.rowIndex) } }) })
      return res })()
    return JSON.stringify(out) })()`
  const all = {}
  for (const t of ['修订记录', '成型工艺清单', '成型配方']) {
    await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(t)}){ ts[i].click(); return 1 } } return 0 })()`)
    await sleep(1200)
    all[t] = JSON.parse(await ev(probe))
  }
  fs.writeFileSync(path.join(__dirname, '_dom-moldproc-p3.txt'), JSON.stringify(all, null, 2), 'utf8')
  console.log('written p3')
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
