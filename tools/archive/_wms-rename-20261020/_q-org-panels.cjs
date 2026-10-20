/** _q-org-panels.cjs — 看组织架构「角色面板」页的实际分组与面板(2026-10-20)
 *  用法(仓库根):node tools/archive/_wms-rename-20261020/_q-org-panels.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9495
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const snap = `(function(){
  var groups = Array.prototype.map.call(document.querySelectorAll('.el-collapse-item'), function(e){
    var t = e.querySelector('.el-collapse-item__header');
    var n = e.querySelectorAll('.perm-panel, .panel-item, .el-checkbox').length;
    return { title: t ? (t.innerText||'').trim() : '', items: n };
  });
  return JSON.stringify({ groupCount: groups.length, groups: groups.slice(0, 20) });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_orgpanels'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Page.reload'); await sleep(9000)

  await ev('location.hash = "#/sys/org"'); await sleep(8000)
  // 切到「角色面板」相关页签(可能叫 角色权限/角色)
  await ev(`(function(){
    var els = document.querySelectorAll('.el-tabs__item, .el-radio-button__inner, .el-menu-item, button');
    for (var i=0;i<els.length;i++){
      var t = (els[i].innerText||'').trim();
      if (t === '角色' || t === '角色权限' || t === '角色面板') { els[i].click(); return t; }
    }
    return 'no-tab';
  })()`)
  await sleep(2000)
  // 选第一个角色(若需要)
  await ev(`(function(){
    var rows = document.querySelectorAll('.el-table__body tr, .role-item');
    if (rows.length) { rows[0].click(); return 'picked-role'; }
    return 'no-role-row';
  })()`)
  await sleep(2500)
  console.log('SNAP ' + await ev(snap))
  await shot('_org-panels.png')
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
