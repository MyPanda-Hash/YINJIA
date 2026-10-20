/** _q-wo-pick.cjs — 活体验证「工单扫码领料」页(2026-10-21)
 *
 *  验证点:
 *   ① 页面能打开、四段布局(工单/秤/清单/提交)都在
 *   ② 扫真实工单码能带出工单内容 + BOM 领料清单
 *   ③ 扫物料码能匹配到 BOM 行并累加
 *   ④ 375 窄屏无横向滚动
 *
 *  用法(仓库根):node tools/archive/_wo-pick-20261021/_q-wo-pick.cjs [工单码] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const CODE = process.argv[2] || 'YJ@GD-2026-10-0220@1001'
const PORT = process.argv[3] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9481
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var rows = document.querySelectorAll('.wop-row');
  return JSON.stringify({
    title: q('.wop-title'),
    orderNo: q('.wop-order-no'),
    lineTag: q('.wop-line-tag'),
    kv: Array.prototype.map.call(document.querySelectorAll('.wop-kv .v'), function(e){return e.innerText.trim()}),
    scale: q('.wop-scale-val'),
    scaleHint: q('.wop-scale-hint'),
    listHead: q('.wop-list-head'),
    empty: q('.wop-empty'),
    rowCount: rows.length,
    firstRow: rows.length ? rows[0].innerText.replace(/\\s+/g,' ').trim() : '',
    err: q('.wop-err'),
    ok: q('.wop-ok'),
    bodyW: document.body.scrollWidth, innerW: window.innerWidth
  });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_wopick'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/scm/workOrderPick"'); await sleep(4000)
  console.log('PAGE ' + await ev(state))
  await shot('_wo-empty.png')

  // ① 扫工单码
  const typed = await ev(`(function(){
    var inp = document.querySelectorAll('.wop-input')[0];
    if (!inp) return 'no-input';
    inp.value = ${JSON.stringify(CODE)};
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return 'typed';
  })()`)
  console.log('TYPE_WO ' + typed)
  await sleep(4500)
  console.log('AFTER_WO ' + await ev(state))
  await shot('_wo-loaded.png')

  // ② 扫物料码(取 BOM 第一行的子件代码,模拟扫码枪)
  const firstCode = await ev(`(function(){
    var e = document.querySelector('.wop-code');
    return e ? e.innerText.trim() : '';
  })()`)
  console.log('FIRST_BOM_CODE ' + firstCode)
  if (firstCode) {
    const typedMat = await ev(`(function(){
      var inps = document.querySelectorAll('.wop-input');
      var inp = inps[inps.length-1];
      if (!inp) return 'no-mat-input';
      inp.value = ${JSON.stringify(firstCode)} + '|';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return 'typed-mat';
    })()`)
    console.log('TYPE_MAT ' + typedMat)
    await sleep(3500)
    console.log('AFTER_MAT ' + await ev(state))
    await shot('_wo-scanned.png')
  }

  // ③ 窄屏 375
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 1, mobile: true })
  await sleep(1200)
  console.log('NARROW ' + await ev(state))
  await shot('_wo-375.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
