/** _q-realpath.cjs — 基线代码下,走真实交互路径找「重复弹窗」(2026-10-18)
 *  P1: 打开库存台账 → 数弹窗
 *  P2: 点弹窗内「查询」执行(需先选仓库/存货? 台账要求必选) → 数弹窗
 *  P3: 再点右上「查询」按钮 → 数弹窗
 *  P4: 关闭弹窗(取消→跳桌面) 后重新进 → 数弹窗
 *  用法(仓库根):node tools/archive/_stock-ledger-dlg-20261018/_q-realpath.cjs
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const BASE = 'http://localhost:5173'
const CDP_PORT = 9465
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const cnt = `(function(){
  var n = 0, titles = [];
  document.querySelectorAll('.el-overlay').forEach(function(ov){
    var st = getComputedStyle(ov); var rc = ov.getBoundingClientRect();
    if (st.display === 'none' || rc.width <= 0) return;
    var d = ov.querySelector('.el-dialog.header-query-dialog');
    if (!d) return;
    n++; titles.push((d.querySelector('.el-dialog__title')||{}).innerText || '');
  });
  return JSON.stringify({ queryDialogs: n, titles: titles, hash: location.hash });
})()`

const clickText = (sel, text) => `(function(){
  var ns = document.querySelectorAll(${JSON.stringify(sel)});
  for (var i=0;i<ns.length;i++){ var t=(ns[i].innerText||'').trim(); if (t === ${JSON.stringify(text)}){ ns[i].click(); return 'ok' } }
  return 'miss';
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_realpath'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200))
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(6000)
  console.log('P1 ' + await ev(cnt))
  await shot('_p1.png')

  // 点弹窗内绿色「查询」按钮(类 el-button--primary 且文字=查询,位于 dialog footer)
  const clicked = await ev(`(function(){
    var dlgs = document.querySelectorAll('.el-dialog.header-query-dialog');
    for (var i=0;i<dlgs.length;i++){
      var bs = dlgs[i].querySelectorAll('.el-dialog__footer button, .query-actions button, button');
      for (var j=0;j<bs.length;j++){ if ((bs[j].innerText||'').trim() === '查询'){ bs[j].click(); return 'clicked-footer-query' } }
    }
    return 'no-footer-query';
  })()`)
  console.log('P2_CICK ' + clicked)
  await sleep(4000)
  console.log('P2 ' + await ev(cnt))
  await shot('_p2.png')

  // 再点顶部「查询」按钮
  const top = await ev(clickText('button', '查询'))
  console.log('P3_CLICK ' + top)
  await sleep(3000)
  console.log('P3 ' + await ev(cnt))
  await shot('_p3.png')

  // 关闭弹窗再重进
  await ev(`(function(){
    var dlgs = document.querySelectorAll('.el-dialog.header-query-dialog');
    for (var i=0;i<dlgs.length;i++){
      var b = dlgs[i].querySelector('.el-dialog__headerbtn'); if (b) { b.click(); return 'closed' } }
    return 'none';
  })()`)
  await sleep(3000)
  console.log('P4_AFTER_CLOSE ' + await ev(cnt))
  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(5000)
  console.log('P4_REENTER ' + await ev(cnt))
  await shot('_p4.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
