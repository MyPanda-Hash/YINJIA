/** _q-stock-query.cjs — 复现「库存台账 查询弹窗重复」并取证(2026-10-18)
 *  统计:点「查询」后页面上可见的 el-dialog 实例数、各自 class/标题/位置,并截图。
 *  用法(仓库根):node tools/archive/_stock-ledger-dlg-20261018/_q-stock-query.cjs [账号] [口令] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const ACC = process.argv[2] || 'admin'
const PWD = process.argv[3] || '123456'
const PORT = process.argv[4] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9461
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const countDialogs = `(function(){
  var out = [];
  var ws = document.querySelectorAll('.el-dialog__wrapper, .el-overlay');
  for (var i = 0; i < ws.length; i++) {
    var w = ws[i];
    var visible = w.offsetParent !== null && getComputedStyle(w).display !== 'none';
    var dlg = w.querySelector('.el-dialog');
    out.push({
      cls: w.className,
      dlgCls: dlg ? dlg.className : '',
      title: (dlg && dlg.querySelector('.el-dialog__title') ? dlg.querySelector('.el-dialog__title').innerText : '') || '',
      visible: visible,
      z: getComputedStyle(w).zIndex,
    });
  }
  return JSON.stringify({
    all: out.length,
    visible: out.filter(function(o){ return o.visible }).length,
    queryDialogs: out.filter(function(o){ return (o.cls + ' ' + o.dlgCls).indexOf('header-query-dialog') >= 0 || o.title === '查询' }).length,
    detail: out
  });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: ACC, password: PWD, factory: 'YJ' }),
  })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) { console.log('FAIL LOGIN'); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})

  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_stockq'), 'about:blank'], { stdio: 'ignore', detached: true })
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 300))
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

  // 进库存台账
  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"')
  await sleep(6000)
  console.log('BEFORE ' + await ev(countDialogs))
  await shot('_before-click.png')

  // 点「查询」按钮
  const clicked = await ev(`(function(){
    var bs = document.querySelectorAll('button');
    for (var i=0;i<bs.length;i++){ var t=(bs[i].innerText||'').trim(); if (t==='查询'){ bs[i].click(); return 'clicked:'+t } }
    return 'no-button';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(3000)
  console.log('AFTER1 ' + await ev(countDialogs))
  await shot('_after-click-1.png')

  // 再点一次(用户可能是重复点)
  await ev(`(function(){
    var bs = document.querySelectorAll('button');
    for (var i=0;i<bs.length;i++){ var t=(bs[i].innerText||'').trim(); if (t==='查询'){ bs[i].click(); return true } }
    return false;
  })()`)
  await sleep(2500)
  console.log('AFTER2 ' + await ev(countDialogs))
  await shot('_after-click-2.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
