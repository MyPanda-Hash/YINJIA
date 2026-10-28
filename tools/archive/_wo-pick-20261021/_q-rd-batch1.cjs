/**
 * _q-rd-batch1.cjs — 验证研发第一批改动(2026-10-21)
 *
 * 验两点(其余靠单测/编译):
 *   ① 物料清单工具栏:审批组消失、出现「修改」
 *   ② 产品规格书封面:长文本换行、表单宽度不超出画布
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-rd-batch1.cjs [端口]
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

const wlbomState = `(function(){
  var names = Array.prototype.map.call(document.querySelectorAll('.act-name'), function(e){return e.innerText.trim()});
  return JSON.stringify({ acts: names, hasApprove: names.indexOf('审批')>=0, hasModify: names.indexOf('修改')>=0 });
})()`

const specState = `(function(){
  var page = document.querySelector('.rsp-cover-page');
  var tbl = document.querySelector('.rsp-cover-fields');
  var cs = tbl ? getComputedStyle(tbl) : null;
  var vl = document.querySelector('.rsp-cover-vl');
  var vs = vl ? getComputedStyle(vl) : null;
  return JSON.stringify({
    hasCover: !!page,
    pageW: page ? Math.round(page.getBoundingClientRect().width) : 0,
    tblW: tbl ? Math.round(tbl.getBoundingClientRect().width) : 0,
    layout: cs ? cs.tableLayout : '',
    vlWhite: vs ? vs.whiteSpace : '',
    overflow: page && tbl ? (tbl.getBoundingClientRect().width > page.getBoundingClientRect().width + 1) : false
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_rdbatch'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  // ① 物料清单
  await ev('location.hash = "#/panelx/list/WLBOM"'); await sleep(6000)
  console.log('WLBOM ' + await ev(wlbomState))
  await shot('_rd-wlbom.png')

  // ② 规格书
  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(6000)
  console.log('SPEC ' + await ev(specState))
  await shot('_rd-spec.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
