/** 只读取证:成型配方在界面上的位置(RD_MOLD_PROC 第 3 个页签) —— 2026-10-21 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9411
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('login failed')
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-moldf-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')); console.log('[shot]', n) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank')
  // ① 菜单路径
  await nav(`${BASE}/#/panelx/list/RD_MOLD_PROC`)
  await sleep(2000)
  await shot('rd-mold-proc-list.png')
  console.log('[面包屑/标题]', await ev(`(() => { const t=document.querySelector('.page-title,.as-page-title,h2'); return (t&&t.textContent.trim())||'(none)' })()`))
  // ② 打开一张单据(有则点首行,无则新增)
  const opened = await ev(`(function(){
    var row=document.querySelector('.el-table__body tr.el-table__row');
    if(row){ var c=row.querySelector('td'); if(c){ c.click(); return 'clicked-row' } }
    return 'no-row' })()`)
  console.log('[打开单据]', opened)
  await sleep(2500)
  if (opened === 'no-row') {
    await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if(all[i].textContent.trim()==='新增' && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
    await sleep(2500)
  }
  console.log('[页签]', JSON.stringify(await ev(`[...document.querySelectorAll('.rsp-page-tab')].map(t=>t.textContent.trim())`)))
  // ③ 切到「成型配方」页签
  await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
    for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()==='成型配方'){ ts[i].click(); return 1 } } return 0 })()`)
  await sleep(1800)
  await shot('rd-mold-formula-tab.png')
  console.log('[配方页大标题]', await ev(`(() => { const e=document.querySelector('.rsp-static-title,.rs-static-title'); return (e&&e.textContent.trim())||'(none)' })()`))
  console.log('[页签序列]', JSON.stringify(await ev(`[...document.querySelectorAll('.rsp-page-tab')].map(t=>t.textContent.trim())`)))
  ws.close(); edge.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
