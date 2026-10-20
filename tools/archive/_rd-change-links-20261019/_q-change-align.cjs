/** _q-change-align.cjs — 验证「申请日期 / 性质」两栏对齐 + 变更文件跳转入口(2026-10-19)
 *  用法(仓库根):node tools/archive/_rd-change-links-20261019/_q-change-align.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9491
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

// 量「申请日期」标签格 与「性质」标签格 的左边缘/宽度,判断是否对齐
const measure = `(function(){
  function cellByText(txt){
    var tds = document.querySelectorAll('td.rs-label');
    for (var i=0;i<tds.length;i++){ if ((tds[i].innerText||'').trim() === txt) return tds[i]; }
    return null;
  }
  var a = cellByText('申请日期');
  var b = cellByText('性质');
  function box(el){ if(!el) return null; var r=el.getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width) }; }
  return JSON.stringify({
    dateLabel: box(a),
    natureLabel: box(b),
    aligned: !!(a && b && Math.abs(a.getBoundingClientRect().left - b.getBoundingClientRect().left) <= 2),
    fileLinks: document.querySelectorAll('.rs-file-links a, .rs-file-links button').length
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_changeAlign'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/RD_CHANGE"'); await sleep(8000)
  console.log('LIST ' + await ev(measure))
  await shot('_change-list.png')

  // 编辑态:勾一个变更文件看复选框
  const toggled = await ev(`(function(){
    var boxes = document.querySelectorAll('.rs-checks .el-checkbox');
    if (!boxes.length) return 'no-checkbox';
    boxes[0].click();
    return 'clicked:' + (boxes[0].innerText||'').trim();
  })()`)
  console.log('TOGGLE ' + toggled)
  await sleep(800)
  await shot('_change-checked.png')
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
