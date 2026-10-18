/** _q-console.cjs — 抓某面板页面的前端异常与 console(2026-10-18)
 *  用法:node tools/archive/_prod-process-audit/_q-console.cjs [panelCode] [端口]
 */
const { spawn } = require('child_process')
const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const CODE = process.argv[2] || 'WO_REPORT'
const PORT = process.argv[3] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9459
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_qcon'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []; const logs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails
      errs.push(String(e.exception && e.exception.description || e.text || '').slice(0, 500))
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push(m.params.args.map((a) => String(a.value !== undefined ? a.value : (a.description || ''))).join(' ').slice(0, 400))
    }
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(7000)
  errs.length = 0; logs.length = 0
  await ev('location.hash = "#/panelx/list/' + CODE + '"')
  await sleep(6000)
  console.log('EXCEPTIONS=' + JSON.stringify(errs, null, 1))
  console.log('CONSOLE_ERRORS=' + JSON.stringify(logs, null, 1))
  console.log('TEXT=' + JSON.stringify(await ev('document.body.innerText.slice(0, 600)')))
  const fs = require('fs')
  const shotName = process.argv[4] || ('_shot-' + CODE + '.png')
  const s = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, shotName), Buffer.from(s.result.data, 'base64'))
  console.log('SHOT=' + shotName)
  console.log('DOM=' + await ev(`JSON.stringify({ tables: document.querySelectorAll('.el-table').length,
    rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    refCtl: document.querySelectorAll('.as-ref-ctl,.rs-ref-ctl').length,
    refLabels: Array.prototype.map.call(document.querySelectorAll('.as-ref-ctl,.rs-ref-ctl'), function(x){
      var box = x.closest('.as-field,.rs-field,.el-form-item,.as-cell,.rs-cell') || x.parentElement;
      return (box ? (box.innerText||'') : '').trim().slice(0, 24) }),
    bodyLen: document.body.innerText.length })`))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
