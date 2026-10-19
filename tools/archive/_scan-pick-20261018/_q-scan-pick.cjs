/** _q-scan-pick.cjs — 活体验证「扫码领料」页(2026-10-18)
 *  打开 /scm/scanPick → 输入真实条码 `YJ-TS-004|20261014001` → 回车 → 看是否带出批号级可用量。
 *  用法(仓库根):node tools/archive/_scan-pick-20261018/_q-scan-pick.cjs [码] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const CODE = process.argv[2] || 'YJ-TS-004|20261014001'
const PORT = process.argv[3] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9471
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var card = document.querySelector('.sp-card');
  var lines = document.querySelectorAll('.sp-line');
  return JSON.stringify({
    alert: (document.querySelector('.sp-alert .el-alert__title')||{}).innerText || '',
    candCount: document.querySelectorAll('.sp-cand').length,
    candName: (document.querySelector('.sp-cand-name')||{}).innerText || '',
    stock: (document.querySelector('.sp-stock-num')||{}).innerText || '',
    candMeta: Array.prototype.map.call(document.querySelectorAll('.sp-cand-meta'), function(e){return e.innerText}).slice(0,4),
    lines: lines.length,
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_scanpick'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  await ev('location.hash = "#/scm/scanPick"'); await sleep(4000)
  console.log('PAGE ' + await ev(state))
  await shot('_scan-empty.png')

  // 输入真实条码并回车(模拟扫码枪)
  const typed = await ev(`(function(){
    var inp = document.querySelector('.sp-scan input');
    if (!inp) return 'no-input';
    inp.value = ${JSON.stringify(CODE)};
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return 'typed';
  })()`)
  console.log('TYPE ' + typed)
  await sleep(3500)
  console.log('RESULT ' + await ev(state))
  await shot('_scan-result.png')

  // 窄屏 375 检查横向滚动
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 1, mobile: true })
  await sleep(1200)
  console.log('NARROW ' + await ev(state))
  await shot('_scan-375.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
