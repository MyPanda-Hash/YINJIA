/** 排查 5:「保存」按钮到底发了什么请求、服务端怎么回的(CDP Network 抓包) */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = 'http://localhost:8090'; const FRONT = BASE
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; const PORT = 9343
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SQL = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026', '-I', '-f', '65001', '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8' })
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-net-'))
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
      net.push({ id: m.params.requestId, url: m.params.request.url.replace(BASE, ''), method: m.params.request.method, post: (m.params.request.postData || '').slice(0, 400), status: null, body: null })
    }
    if (m.method === 'Network.responseReceived') { const r = net.filter((x) => x.id === m.params.requestId)[0]; if (r) r.status = m.params.response.status }
    if (m.method === 'Network.loadingFinished') {
      const r = net.filter((x) => x.id === m.params.requestId)[0]
      if (r && !r.body && r.url.indexOf('getFormDescriptor') < 0) send('Network.getResponseBody', { requestId: m.params.requestId }).then((rr) => { r.body = String(rr?.result?.body || '').slice(0, 300) })
    }
  })
  const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } } }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await nav(`${FRONT}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank'); await nav(`${FRONT}/#/panelx/list/RD_MOLD_PROC`); await sleep(2500)
  const btnBefore = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){ return b.textContent.trim() + '|dis=' + (b.classList.contains('is-disabled')||b.disabled||b.getAttribute('disabled')||'-') })`)
  console.log('按钮(点新增前):', JSON.stringify(btnBefore))
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
  await sleep(3000)
  net.length = 0
  const btnAfter = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){ return b.textContent.trim() + '|dis=' + (b.classList.contains('is-disabled')||b.disabled||b.getAttribute('disabled')||'-') })`)
  console.log('按钮(新增后):', JSON.stringify(btnAfter))
  console.log('新增提示:', await ev(`[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.innerText||'').trim()})`))
  console.log('库内最新号:', SQL("SELECT TOP 1 单据编号 FROM rd_mold_proc_head ORDER BY id DESC").trim())
  // 点保存
  const clicked = await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
    for(var i=0;i<all.length;i++){ if(all[i].offsetParent && all[i].textContent.trim()==='保存'){ all[i].click(); return 'CLICKED|dis=' + (all[i].classList.contains('is-disabled')||'-') } } return 'NO_BTN' })()`)
  console.log('点保存:', clicked)
  for (const t of [500, 1200, 2500, 5000]) {
    await sleep(t === 500 ? 500 : t - 500)
    console.log(`  +${t}ms 提示:`, JSON.stringify(await ev(`[].slice.call(document.querySelectorAll('.el-message,.el-message-box')).filter(function(m){return m.offsetParent}).map(function(m){return (m.innerText||'').replace(/\\n/g,' ').trim()})`)))
  }
  console.log('--- 网络 ---')
  for (const r of net) console.log(`${r.method} ${r.url} → ${r.status}\n    req=${r.post}\n    res=${r.body}`)
  const newest = SQL("SELECT TOP 1 单据编号 FROM rd_mold_proc_head ORDER BY id DESC").trim()
  console.log('库内最新号(保存后):', newest, '| 该单是否有值:', SQL(`SELECT ISNULL(单据日期,'null')+'|prod=['+ISNULL(产品编号,'')+']' FROM rd_mold_proc_head WHERE 单据编号='${newest}'`).trim())
  SQL(`DELETE FROM rd_mold_proc_detail WHERE 单据编号='${newest}'; DELETE FROM rd_mold_proc_head WHERE 单据编号='${newest}';`)
  console.log('已清理', newest)
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
