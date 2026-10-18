/** _q-dlg-count.cjs — 数「查询弹窗」可见实例(修正可见判断:fixed 元素 offsetParent 恒 null,改用 getBoundingClientRect)
 *  场景:库存台账(STOCK_LEDGER) 与 收发存汇总(STOCK_SUMMARY) 都是 reportQueryDialog 面板。
 *  用法(仓库根):node tools/archive/_stock-ledger-dlg-20261018/_q-dlg-count.cjs
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const BASE = process.env.QBASE || 'http://localhost:5173'
const CDP_PORT = 9462
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const probe = `(function(){
  var out = [];
  var ws = document.querySelectorAll('.el-overlay');
  for (var i = 0; i < ws.length; i++) {
    var w = ws[i];
    var st = getComputedStyle(w);
    var rect = w.getBoundingClientRect();
    var vis = st.display !== 'none' && st.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && Number(st.opacity) > 0;
    if (!vis) continue;
    var dlg = w.querySelector('.el-dialog');
    out.push({
      title: (dlg && dlg.querySelector('.el-dialog__title')) ? dlg.querySelector('.el-dialog__title').innerText.trim() : '',
      cls: dlg ? dlg.className : '',
      z: st.zIndex,
      bg: st.backgroundColor,
    });
  }
  return JSON.stringify({ visibleOverlays: out.length, items: out });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_dlgcount'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  console.log('--- 场景1: 打开库存台账 ---')
  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(6000)
  console.log('LEDGER ' + await ev(probe))
  await shot('_v2-ledger.png')

  console.log('--- 场景2: 页签里再开 收发存汇总(不通关弹窗) ---')
  // 模拟"再开一个面板页签":直接用路由切到 STOCK_SUMMARY
  await ev('location.hash = "#/panelx/list/STOCK_SUMMARY"'); await sleep(6000)
  console.log('SUMMARY ' + await ev(probe))
  console.log('HASH2 ' + await ev('location.hash'))
  await shot('_v2-summary.png')

  console.log('--- 场景3: 切回库存台账 ---')
  await ev('location.hash = "#/panelx/list/STOCK_LEDGER"'); await sleep(5000)
  console.log('BACK ' + await ev(probe))
  await shot('_v2-back.png')

  console.log('--- 场景4: 检查页面里 PanelxList 实例数(页签缓存) ---')
  console.log('APPS ' + await ev(`JSON.stringify({
    panelxRoots: document.querySelectorAll('.panelx-list, [class*="panelx"]').length,
    tabItems: Array.prototype.map.call(document.querySelectorAll('.page-tabs .tab, .tabs-bar .tab, .el-tabs__item'), function(t){ return (t.innerText||'').trim() }).slice(0,10)
  })`))

  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
