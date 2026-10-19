/** _q-unaudit2.cjs — 验证「弃审只弹一次窗」(2026-10-19)
 *  规格书列表 → 点中已归档单 SD-2026-10-0001 → 点侧栏「弃审」→ 数弹窗(期望 1)。
 *  用法(仓库根):node tools/archive/_rd-doclists-20261019/_q-unaudit2.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9493
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var boxes = document.querySelectorAll('.el-message-box');
  return JSON.stringify({
    boxes: boxes.length,
    titles: Array.prototype.map.call(document.querySelectorAll('.el-message-box__title'), function(e){ return (e.innerText||'').trim() }),
    bodyFirst180: Array.prototype.map.call(document.querySelectorAll('.el-message-box__message'), function(e){ return (e.innerText||'').trim().slice(0,180) }),
    sideBtns: Array.prototype.map.call(document.querySelectorAll('.as-side-btn, .as-side-btn.sub'), function(e){ return (e.innerText||'').trim() }).filter(Boolean)
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_unaudit2'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
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
  console.log('LIST ' + await ev(state))

  // 点中第一行(已归档的 SD-2026-10-0001 排最前)
  const picked = await ev(`(function(){
    var rows = document.querySelectorAll('.el-table__body tr, tbody tr');
    for (var i=0;i<rows.length;i++){
      var t = (rows[i].innerText||'');
      if (t.indexOf('SD-2026-10-0001') >= 0) { rows[i].click(); return 'picked:' + t.slice(0,40); }
    }
    if (rows.length) { rows[0].click(); return 'picked-first'; }
    return 'no-rows';
  })()`)
  console.log('PICK ' + (picked || '').slice(0, 120))
  await sleep(2500)
  console.log('AFTER-PICK ' + await ev(state))

  // 点「弃审」
  const clicked = await ev(`(function(){
    var els = document.querySelectorAll('.as-side-btn, .as-side-btn.sub');
    for (var i=0;i<els.length;i++){ if ((els[i].innerText||'').trim() === '弃审'){ els[i].click(); return 'clicked'; } }
    return 'no-btn';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(1800)
  console.log('AFTER-CLICK ' + await ev(state))
  await shot('_unaudit2.png')
  // 等一下看会不会又冒一个
  await sleep(1500)
  console.log('AFTER-WAIT ' + await ev(state))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
