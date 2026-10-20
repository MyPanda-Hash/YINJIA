/** _q-unaudit-popup.cjs — 验证「点击弃审只弹一次窗」(2026-10-19)
 *  打开规格书列表 → 选一张已归档单 → 点侧栏「弃审」→ 数 ElMessageBox 弹窗数量(期望 1)。
 *  用法(仓库根):node tools/archive/_rd-doclists-20261019/_q-unaudit-popup.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9492
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const countBox = `JSON.stringify({
  boxes: document.querySelectorAll('.el-message-box').length,
  titles: Array.prototype.map.call(document.querySelectorAll('.el-message-box__title'), function(e){ return (e.innerText||'').trim() }),
  visibleBoxes: Array.prototype.filter.call(document.querySelectorAll('.el-message-box'), function(e){ return e.offsetParent !== null }).length
})`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_unaudit'), 'about:blank'], { stdio: 'ignore', detached: true })
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 160))
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

  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(9000)
  console.log('BEFORE ' + await ev(countBox))
  // 找侧栏「弃审」按钮并点一次
  const clicked = await ev(`(function(){
    var els = document.querySelectorAll('.as-side-btn, .as-side-btn.sub');
    for (var i=0;i<els.length;i++){ if ((els[i].innerText||'').trim() === '弃审'){ els[i].click(); return 'clicked'; } }
    return 'no-unaudit-btn';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(1500)
  console.log('AFTER-1 ' + await ev(countBox))
  await shot('_unaudit-popup.png')
  await sleep(1200)
  console.log('AFTER-2 ' + await ev(countBox))
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 2)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
