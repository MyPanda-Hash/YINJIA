/** 排查 6:直接读 PanelxList 的 setupState,看「保存」为什么被静默忽略 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = BASE
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9344
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SQL = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026', '-I', '-f', '65001', '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8' })
const STATE = `(function(){
  var btns=[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){
    return b.textContent.trim() + (b.classList.contains('disabled') ? '[GREY]' : '') })
  var sheet=document.querySelector('.record-sheet')
  var inputs=[].slice.call(document.querySelectorAll('.record-sheet td input, .record-sheet td textarea')).filter(function(i){return i.offsetParent}).length
  var spans=document.querySelectorAll('.record-sheet .rs-txt, .record-sheet span').length
  return JSON.stringify({ btns: btns, sheetInputs: inputs, spans: spans,
    status: (function(){ var n=[].slice.call(document.querySelectorAll('.as-side-status-row, .as-side-status')).map(function(x){return (x.innerText||'').replace(/\\s+/g,' ').trim()}); return n.join(' / ') })(),
    curRow: (function(){ var r=document.querySelector('.el-table__row.current-row, .el-table__row.current'); return r? (r.innerText||'').replace(/\\s+/g,' ').slice(0,60) : 'NO_CURRENT_ROW' })() }) })()`
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-vs-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map(); const net = []
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d.toString()) } catch { return }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Network.requestWillBeSent' && /\/api\//.test(m.params.request.url)) {
      net.push({ id: m.params.requestId, url: m.params.request.url.replace(BASE, ''), method: m.params.request.method, post: (m.params.request.postData || '').slice(0, 500), status: null, body: null })
    }
    if (m.method === 'Network.responseReceived') { const r = net.filter((x) => x.id === m.params.requestId)[0]; if (r) r.status = m.params.response.status }
    if (m.method === 'Network.loadingFinished') { const r = net.filter((x) => x.id === m.params.requestId)[0]
      if (r && !r.body && r.url.indexOf('getFormDescriptor') < 0 && r.url.indexOf('callButton') >= 0) send('Network.getResponseBody', { requestId: m.params.requestId }).then((rr) => { r.body = String(rr?.result?.body || '').slice(0, 400) }) }
  })
  const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return 'ERR:' + r.result.exceptionDetails.text; return r.result?.result?.value }
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await nav(`${FRONT}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank'); await nav(`${FRONT}/#/panelx/list/RD_MOLD_PROC`); await sleep(2500)
  console.log('状态(进页面):', await ev(STATE))
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
  await sleep(3000)
  await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
    for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()==='成型工艺清单'){ ts[i].click(); return 1 } } return 0 })()`)
  await sleep(1500)
  console.log('状态(新增+切页后):', await ev(STATE))
  console.log('表头是否有可编辑 input:', await ev(`(function(){ var i=document.querySelector('.record-sheet .rs-docno-wrap input'); return i? 'YES|v='+i.value : 'NO(只读态渲染)' })()`))
  console.log('炭棒编号值行控件数:', await ev(`(function(){ var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(td){return td.offsetParent && (td.innerText||'').trim()==='炭棒编号'})
    if(!tds.length) return 'NO_LABEL'; var nx=tds[0].parentElement.nextElementSibling
    return nx ? [].slice.call(nx.querySelectorAll('input,textarea,.rs-ref-ctl,.el-select__wrapper')).length : 'NO_NEXTROW' })()`))
  // 填一格(配料要求)造 dirty
  await ev(`(function(){ var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(td){return td.offsetParent && (td.innerText||'').trim()==='配料要求'})
    if(!tds.length) return 'NO_LABEL'
    var tr=tds[0].parentElement, i=tr.querySelector('textarea')||tr.querySelector('input'); if(!i) return 'NO_INPUT'
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(i,'排查:填写一格')
    i.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
  await sleep(800)
  console.log('状态(填一格后):', await ev(STATE))
  net.length = 0
  console.log('点保存:', await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].offsetParent && all[i].textContent.trim()==='保存'){ all[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`))
  await sleep(3500)
  console.log('状态(点保存后):', await ev(STATE))
  console.log('提示:', await ev(`[].slice.call(document.querySelectorAll('.el-message,.el-message-box')).filter(function(m){return m.offsetParent}).map(function(m){return (m.innerText||'').replace(/\\n/g,' ').trim()})`))
  console.log('--- 保存期网络 ---')
  for (const r of net) console.log(`${r.method} ${r.url} → ${r.status}\n    req=${r.post}\n    res=${r.body}`)
  const newest = SQL('SELECT TOP 1 单据编号 FROM rd_mold_proc_head ORDER BY id DESC').trim()
  console.log('库内最新:', newest, '| 配料要求=', SQL(`SELECT '['+ISNULL(配料要求,'')+']' FROM rd_mold_proc_head WHERE 单据编号='${newest}'`).trim())
  SQL(`DELETE FROM rd_mold_proc_detail WHERE 单据编号='${newest}'; DELETE FROM rd_mold_proc_head WHERE 单据编号='${newest}';`)
  console.log('已清理', newest)
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
