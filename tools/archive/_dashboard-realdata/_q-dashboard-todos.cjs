/** _q-dashboard-todos.cjs — 看板「流程待办」接真实数据核验(2026-10-18,用户 m00994)
 *
 * 核验点:
 *  1. /api/dashboard/stats 的 archives.invItems 与「存货」面板行数同源(bs_inv,预期 3917);
 *  2. todos 不再是空数组(=pending 单据),且条数与 kpis.approvePending 一致;
 *  3. 页面上「流程待办」数字 = todos.length,悬停 title 列出真实单据号;
 *  4. 概览页无 JS 异常。
 *
 * 依赖:Edge headless + tools/verify/lib/mini-ws.cjs;8090 已在跑。
 * 跑法:node tools/archive/_dashboard-realdata/_q-dashboard-todos.cjs
 */
const CDP_PORT = 9446
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname, BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const r0 = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j0 = await r0.json(); const token = j0.data.token; const user = JSON.stringify(j0.data.user || {})
  const stat = await (await fetch(BASE + '/api/dashboard/stats', { headers: { Authorization: 'Bearer ' + token } })).json()
  const inv = await (await fetch(BASE + '/api/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1, countOnly: true }) })).json()
  console.log('API ' + JSON.stringify({ invItems: stat.data.archives.invItems, invPanelRows: inv.data.totalSize, todos: stat.data.todos.length, approvePending: stat.data.kpis.approvePending, bomTree: stat.data.production.bomTree, todoDocs: (stat.data.todos || []).map((t) => t.docNo) }))
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_dashboard_realdata_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160)) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => { const res = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (res.result?.exceptionDetails) throw new Error('EVAL: ' + (res.result.exceptionDetails.exception?.description || '').slice(0, 300)); return res.result?.result?.value }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(8000)
  if ((await ev('location.hash')) !== '#/dashboard') { await ev('location.hash = "#/dashboard"'); await sleep(5000) }
  console.log('UI ' + await ev(`(function(){
    var rows = Array.prototype.slice.call(document.querySelectorAll('.quality-facts div'))
    var hit = null
    for (var i=0;i<rows.length;i++){ var s = rows[i].querySelector('span'); if (s && /流程待办/.test(s.innerText||'')) { hit = rows[i] } }
    var strong = hit && hit.querySelector('strong')
    return JSON.stringify({ hash: location.hash, label: hit ? hit.querySelector('span').innerText : '', value: strong ? strong.innerText : '', title: strong ? strong.getAttribute('title') : '' })
  })()`))
  await shot('_dashboard-todos-1440.png')
  // 档案卡:物料数应与存货面板同源
  console.log('ARCHIVE ' + await ev(`(function(){
    var t = (document.querySelector('#app')||document.body).innerText.replace(/\\s+/g,' ')
    var m = t.match(/物料[^0-9]{0,6}([0-9,]+)/)
    return JSON.stringify({ hit: m ? m[0] : '', snippet: m ? m[1] : '' })
  })()`))
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
