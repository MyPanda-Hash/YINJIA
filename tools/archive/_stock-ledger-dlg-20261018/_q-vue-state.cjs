/** _q-vue-state.cjs — 验证「遮罩残留」假设:读每个可见查询弹窗背后 PanelxList 实例里 queryDialogVisible 的真实值
 *  用法(仓库根):node tools/archive/_stock-ledger-dlg-20261018/_q-vue-state.cjs
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const BASE = 'http://localhost:5173'
const CDP_PORT = 9463
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

// 从 .el-dialog 往上爬 Vue 实例链,找持有 queryDialogVisible 的那个组件
const vueState = `(function(){
  var res = [];
  var overlays = document.querySelectorAll('.el-overlay');
  for (var i = 0; i < overlays.length; i++) {
    var ov = overlays[i];
    var st = getComputedStyle(ov);
    if (st.display === 'none') continue;
    var dlg = ov.querySelector('.el-dialog');
    if (!dlg) continue;
    var inst = dlg.__vueParentComponent || dlg.parentElement.__vueParentComponent;
    var found = null, depth = 0, chain = [];
    while (inst && depth < 30) {
      var ss = inst.setupState || {};
      var hasQ = Object.prototype.hasOwnProperty.call(ss, 'queryDialogVisible');
      chain.push((inst.type && (inst.type.name || inst.type.__name)) || '?');
      if (hasQ) {
        found = {
          comp: (inst.type && (inst.type.name || inst.type.__name)) || '?',
          queryDialogVisible: !!ss.queryDialogVisible,
          isActive: inst.isActive !== undefined ? inst.isActive : null,
          panelCode: ss.panelCode ? (ss.panelCode.value !== undefined ? ss.panelCode.value : ss.panelCode) : null,
          rqdDone: ss.rqdDone ? (ss.rqdDone.value !== undefined ? ss.rqdDone.value : ss.rqdDone) : null,
        };
        break;
      }
      inst = inst.parent; depth++;
    }
    res.push({
      title: (dlg.querySelector('.el-dialog__title')||{}).innerText || '',
      z: st.zIndex,
      owner: found,
      chainTail: chain.slice(0, 6),
    });
  }
  return JSON.stringify({ overlaysVisible: res.length, items: res });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_vuestate'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(6000)
  console.log('LEDGER  ' + await ev(vueState))
  await ev('location.hash = "#/panelx/list/STOCK_SUMMARY"'); await sleep(6000)
  console.log('SUMMARY ' + await ev(vueState))
  console.log('HASH    ' + await ev('location.hash'))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
