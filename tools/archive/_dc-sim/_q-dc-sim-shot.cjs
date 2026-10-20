/** _q-dc-sim-shot.cjs — 模拟设备上报期间,活体截取「数据监控」「状态统计」两页(选 SIM-SCALE-01 设备)。2026-10-18 */
const CDP_PORT = 9447;
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os');
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
const OUT = __dirname, BASE = 'http://127.0.0.1:8090';
const ACC = process.argv[2] || 'admin', PWD = process.argv[3] || '123456', FACTORY = process.argv[4] || 'YJ';
const DEV = process.argv[5] || 'SIM-SCALE-01';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
const readKpis = "(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-kpi'), function (k) { return { label: (k.querySelector('.dc-kpi-label')||{}).innerText || '', num: (k.querySelector('.dc-kpi-num')||{}).innerText || '' } })) })()";
const readTables = "(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-table'), function (tb, i) { var rows = Array.prototype.map.call(tb.querySelectorAll('.el-table__body-wrapper tbody tr'), function (tr) { return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return (td.innerText||'').trim() }).join(' | ') }); var empty = tb.querySelector('.el-table__empty-text'); return { i: i, rows: rows, empty: empty ? (empty.innerText||'').trim() : null } })) })()";

async function main() {
  const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }) });
  const lj = await lr.json();
  if (!lj.data || !lj.data.token) { console.log('LOGIN_FAIL ' + JSON.stringify(lj).slice(0, 300)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {});
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_dcsim_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true });
  proc.unref(); await sleep(4000);
  let list;
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page');
  const { connect } = require('../../verify/lib/mini-ws.cjs');
  let id = 0; const pending = new Map(); const errs = [];
  const sock = await connect(target.webSocketDebuggerUrl);
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200)) });
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) });
  const ev = async (e) => { const res = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (res.result && res.result.exceptionDetails) throw new Error('EVAL: ' + String(res.result.exceptionDetails.exception && res.result.exceptionDetails.exception.description || '').slice(0, 300)); return res.result && res.result.result ? res.result.result.value : undefined };
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500);
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')');
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')');
  await send('Page.reload'); await sleep(7000);

  const go = async (hash) => { await ev('location.hash = "' + hash + '"'); await sleep(4500) };
  await go('#/dc/monitor');
  const picked = await ev('(function(){ var ds = document.querySelectorAll(".dc-dev"); for (var i = 0; i < ds.length; i++) { if ((ds[i].innerText||"").indexOf(' + JSON.stringify(DEV) + ') >= 0) { ds[i].click(); return "clicked:" + i } } return "not-found" })()');
  console.log('MON_PICK ' + picked);
  await sleep(4000);
  console.log('MON_DEVS ' + await ev("JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-dev'), function (d) { return (d.innerText||'').replace(/\\s+/g,' ').trim() }))"));
  console.log('MON_HEAD ' + await ev("JSON.stringify({ h1: (document.querySelector('h1.dc-title')||{}).innerText, dev: (document.querySelector('.dc-dev-title')||{}).innerText, sub: (document.querySelector('.dc-dev-sub')||{}).innerText })"));
  console.log('MON_TABLES ' + await ev(readTables));
  await shot('_dc-sim-monitor-1440.png');

  await go('#/dc/stats');
  console.log('ST_KPI ' + await ev(readKpis));
  console.log('ST_TABLES ' + await ev(readTables));
  await shot('_dc-sim-stats-1440.png');
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)));
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) {}
  process.exit(0);
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) });
