/**
 * _q-scan-log.cjs — 活体验证「扫码领料记录」页(2026-10-21)
 *
 * 验证点:
 *   ① 页面能打开、筛选条/汇总/表格/分页都在
 *   ② 表格里能看到真实留痕行(工单号/物料/数量/秤读数/扫码方式/客户端)
 *   ③ 375 窄屏不裁切(表格横向滚动由容器承接,页面本身不横向滚动)
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-scan-log.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9485
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var trs = document.querySelectorAll('.psl-table tbody tr');
  var first = trs.length ? trs[0].innerText.replace(/\\s+/g,' ').trim() : '';
  return JSON.stringify({
    title: q('.psl-title'),
    sum: q('.psl-sum'),
    rowCount: trs.length,
    firstRow: first.slice(0, 260),
    empty: q('.psl-empty'),
    err: q('.psl-err'),
    pager: q('.psl-page-no'),
    bodyW: document.body.scrollWidth, innerW: window.innerWidth,
    overflowX: document.body.scrollWidth > window.innerWidth + 1
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_scanlog'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  await ev('location.hash = "#/scm/pickScanLog"'); await sleep(4000)
  console.log('WIDE ' + await ev(state))
  await shot('_scanlog-1440.png')

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 1, mobile: true })
  await sleep(1500)
  console.log('NARROW ' + await ev(state))
  await shot('_scanlog-375.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
