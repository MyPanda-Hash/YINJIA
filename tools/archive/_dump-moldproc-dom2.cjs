/** 排查 2:模板容器/可见性、页签、按钮、REF 与 SELECT 的真实结构 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9338
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom2-'))
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
  const report = {}
  report.tabs = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){ return t.textContent.trim() + (t.className.indexOf('active')>=0?'[ACTIVE]':'') }) })()`)
  report.containers = await ev(`(function(){ var out=[]
    ;[].slice.call(document.querySelectorAll('table,div')).forEach(function(el){
      if(el.classList.contains('record-sheet') || el.className.indexOf('record-sheet')>=0 || el.className.indexOf('rs-page')>=0){
        var trs=el.querySelectorAll('tr').length
        out.push(el.tagName + '.' + el.className + ' trs=' + trs + ' vis=' + (el.offsetParent?1:0) + ' parent=' + (el.parentElement?el.parentElement.className:'-').slice(0,50))
      } })
    return out })()`)
  report.buttons = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.record-sheet button, .record-sheet .rs-add, .record-sheet [class*=add], .rs-toolbar button')).map(function(b){
      return b.className.slice(0,40) + '|' + (b.textContent||'').trim().slice(0,14) + '|vis=' + (b.offsetParent?1:0) }) })()`)
  report.refCtl = await ev(`(function(){ var rs=document.querySelectorAll('.record-sheet'); if(!rs.length) return 'NO'
    var ref=rs[0].querySelector('.rs-ref-ctl'); if(!ref) return 'NO_REF'
    var td=ref.closest('td')
    return JSON.stringify({ refTag: ref.tagName, refCls: ref.className, refHtml: ref.outerHTML.slice(0,300), tdIdx: [].indexOf.call(td.parentElement.children, td) }) })()`)
  report.selectCtl = await ev(`(function(){ var rs=document.querySelectorAll('.record-sheet'); var td=null
    ;[].slice.call(rs[0].querySelectorAll('td')).forEach(function(c){ if(!td && c.querySelector('.el-select')) td=c })
    if(!td) return 'NO_SELECT'
    var inp=td.querySelector('input')
    return JSON.stringify({ inputCls: inp?inp.className:'-', inputPh: inp?inp.getAttribute('placeholder'):'-', readOnly: inp?inp.readOnly:'-', wrapperCls: (td.querySelector('.el-select__wrapper')||{}).className, html: td.innerHTML.slice(0,260) }) })()`)
  report.gridSection = await ev(`(function(){ var rs=document.querySelectorAll('.record-sheet')
    var out=[]
    ;[].slice.call(rs[0].querySelectorAll('tr')).forEach(function(tr,i){ if(tr.className.indexOf('rs-grp')>=0){
      var sec=tr.closest('tbody,table')
      out.push('grpTr=' + i + ' hdr=' + [].slice.call(tr.children).map(function(c){return (c.textContent||'').trim().slice(0,8)}).join('/') )
    } })
    // 找配方表区段附近所有可点元素
    var bar=null
    ;[].slice.call(rs[0].querySelectorAll('.rs-sectionbar')).forEach(function(b){ if(/配方表/.test(b.textContent)) bar=b })
    if(bar){ out.push('BAR_HTML=' + bar.outerHTML.slice(0,400))
      var next=bar.closest('tr') ? bar.closest('tr').nextElementSibling : null
      var k=0, n=next
      while(n && k<3){ out.push('after' + k + '=' + (n.innerHTML||'').replace(/\\s+/g,' ').slice(0,320)); n=n.nextElementSibling; k++ } }
    return out.join('\\n') })()`)
  fs.writeFileSync(path.join(__dirname, '_dom-moldproc-p2.txt'), JSON.stringify(report, null, 2), 'utf8')
  console.log('written p2')
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
