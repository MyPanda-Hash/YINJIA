/**
 * _q-dc-config-shot.cjs — 活体截取「设备配置管理」页(测试账套 YJ_TEST),复核批量绑定结果。2026-10-20
 *
 * 用法: node _q-dc-config-shot.cjs [账号] [口令] [工厂]
 * 产物: _dc-config-<stamp>.png + 控制台打印汇总卡与前 5 行(网关列 / 完成度)。
 */
const CDP_PORT = 9451;
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os');
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
const OUT = __dirname, BASE = 'http://127.0.0.1:8090';
const ACC = process.argv[2] || 'admin', PWD = process.argv[3] || '123456', FACTORY = process.argv[4] || 'YJ_TEST';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const readKpis = "(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-kpi'), function (k) { return { label: (k.querySelector('.dc-kpi-label')||{}).innerText || '', num: (k.querySelector('.dc-kpi-num')||{}).innerText || '' } })) })()";
const readRows = "(function(){ var tb = document.querySelector('.dc-table'); if (!tb) return 'no-table'; var trs = tb.querySelectorAll('.el-table__body-wrapper tbody tr'); return JSON.stringify(Array.prototype.map.call(trs, function (tr) { return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return (td.innerText||'').trim().replace(/\\s+/g,' ') }).join(' | ') }).slice(0,5)) })()";

async function main() {
  const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }) });
  const lj = await lr.json();
  if (!lj.data || !lj.data.token) { console.log('LOGIN_FAIL ' + JSON.stringify(lj).slice(0, 300)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {});
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_dccfg_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true });
  proc.unref(); await sleep(4000);
  let list;
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page');
  const { connect } = require('../../verify/lib/mini-ws.cjs');
  let id = 0; const pending = new Map();
  const sock = await connect(target.webSocketDebuggerUrl);
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) });
  const ev = async (e) => { const res = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return res.result && res.result.result ? res.result.result.value : undefined; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500);
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')');
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')');
  await send('Page.reload'); await sleep(7000);
  await ev('location.hash = "#/dc/config"'); await sleep(6000);
  console.log('KPIS ' + await ev(readKpis));
  console.log('ROWS ' + await ev(readRows));
  const s = await send('Page.captureScreenshot', { format: 'png' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(OUT, '_dc-config-' + stamp + '.png');
  fs.writeFileSync(file, Buffer.from(s.result.data, 'base64'));
  console.log('SHOT ' + file);
  proc.kill();
  process.exit(0);
}
main().catch((e) => { console.log('FAIL ' + e.message); process.exit(1) });
