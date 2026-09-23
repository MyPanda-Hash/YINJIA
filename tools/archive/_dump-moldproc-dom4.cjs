/** 排查 4:新增后单据编号落在哪 + rs-add 的真实位置/归属 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = BASE
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9342
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SQL = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026', '-I', '-f', '65001', '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8' })
async function main() {
  const before = SQL("SELECT ISNULL(MAX(CAST(REPLACE(REPLACE(单据编号,'MP-',''),'-','') AS bigint)),0) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-%'").trim()
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom4-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
  await send('Page.enable'); await send('Runtime.enable')
  await nav(`${FRONT}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank'); await nav(`${FRONT}/#/panelx/list/RD_MOLD_PROC`); await sleep(2500)
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
  await sleep(3000)
  await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
    for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()==='成型工艺清单'){ ts[i].click(); return 1 } } return 0 })()`)
  await sleep(1500)
  const out = {}
  out.headText = await ev(`(function(){ var t=document.querySelector('.record-sheet'); if(!t) return 'NO_SHEET'
    var trs=[].slice.call(t.querySelectorAll('tr')).slice(0,3)
    return trs.map(function(tr,i){ return 'tr'+i+': '+(tr.innerText||'').replace(/\\s+/g,' ').slice(0,90) }).join(' || ') })()`)
  out.inputs = await ev(`[].slice.call(document.querySelectorAll('input')).filter(function(i){return i.offsetParent}).slice(0,12).map(function(i){ return (i.className||'-')+'|ph='+(i.placeholder||'-')+'|v='+i.value+'|ro='+i.readOnly })`)
  out.docno = await ev(`(function(){ var n=document.querySelector('.rs-docno-wrap, .rs-docno'); return n? n.outerHTML.slice(0,260) : 'NO_DOCNO_NODE' })()`)
  out.mpAnywhere = await ev(`(function(){ var m=(document.body.innerText||'').match(/MP-[0-9]{4}-[0-9]{2}-[0-9]{4}/); return m? m[0] : 'NONE' })()`)
  out.rsAdd = await ev(`(function(){ return [].slice.call(document.querySelectorAll('.rs-add')).map(function(a){
      var bar=null, all=[].slice.call(document.querySelectorAll('.rs-sectionbar'))
      for (var i=0;i<all.length;i++){ if (all[i].compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING){ var txt=(all[i].textContent||'').trim(); if(txt) bar=txt } }
      return a.tagName+'|vis='+(a.offsetParent?1:0)+'|text='+(a.textContent||'').trim().slice(0,14)+'|bar='+(bar||'-').slice(0,16) }) })()`)
  out.tabAct = await ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()+(t.className.indexOf('active')>=0?'*':'')})`)
  fs.writeFileSync(path.join(__dirname, '_dom-moldproc-p4.txt'), JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify(out, null, 2))
  const after = SQL("SELECT TOP 1 单据编号 FROM rd_mold_proc_head ORDER BY id DESC").trim()
  console.log('库内最新单号:', after, ' (探针前最大:', before + ')')
  // 清理这张刚建的空白草稿
  SQL(`DELETE FROM rd_mold_proc_detail WHERE 单据编号='${after}'; DELETE FROM rd_mold_proc_head WHERE 单据编号='${after}';`)
  console.log('已清理', after)
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
