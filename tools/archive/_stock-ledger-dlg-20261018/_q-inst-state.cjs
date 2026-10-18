/** _q-inst-state.cjs — 直接遍历 Vue 组件树,读所有 PanelxList 实例的 reportQueryDialog / rqdDone / queryDialogVisible
 *  用法(仓库根):node tools/archive/_stock-ledger-dlg-20261018/_q-inst-state.cjs
 */
const { spawn } = require('child_process')
const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const BASE = 'http://localhost:5173'
const CDP_PORT = 9464
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const dumpInstances = `(function(){
  var out = [];
  var seen = new Set();
  function walk(inst, depth){
    if (!inst || depth > 40 || seen.has(inst)) return;
    seen.add(inst);
    var ss = inst.setupState || {};
    if (Object.prototype.hasOwnProperty.call(ss, 'queryDialogVisible')) {
      var g = function(k){ var v = ss[k]; return v && v.value !== undefined ? v.value : v; };
      out.push({
        uid: g('qdlgUid'),
        panelCode: g('panelCode'),
        reportQueryDialog: g('reportQueryDialog'),
        rqdDone: g('rqdDone'),
        queryDialogVisible: g('queryDialogVisible'),
        suppress: g('suppressCloseRedirect'),
        isActive: inst.isActive,
        isDeactivated: inst.isDeactivated,
        isMounted: inst.isMounted
      });
    }
    if (inst.subTree) walk(inst.subTree.component, depth+1);
    var ch = inst.subTree && inst.subTree.children;
    function walkArr(arr){
      if (!Array.isArray(arr)) return;
      for (var i=0;i<arr.length;i++){ var c = arr[i]; if (c && c.component) walk(c.component, depth+1); else if (c && c.children) walkArr(c.children); }
    }
    walkArr(ch);
  }
  var app = document.querySelector('#app');
  var vm = app && app.__vue_app__ && app.__vue_app__._instance;
  walk(vm, 0);
  return JSON.stringify({ count: out.length, instances: out, overlays: document.querySelectorAll('.el-overlay').length });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_inststate'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  await ev('location.hash = "#/panelx/list/STOCK_SUMMARY"'); await sleep(6000)
  console.log('SUMMARY-FIRST ' + await ev(dumpInstances))
  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(6000)
  console.log('LEDGER-AFTER  ' + await ev(dumpInstances))
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms))
  await sleep2(100)
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
