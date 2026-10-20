/** _q-dc-stats-w.cjs — 状态统计页在 1440/768/375 的表格宽度与列头取证(判裁切)。2026-10-18 */
const CDP_PORT = 9448;
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os');
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
const OUT = __dirname, BASE = 'http://127.0.0.1:8090';
const ACC = process.argv[2] || 'admin', PWD = process.argv[3] || '123456', FACTORY = process.argv[4] || 'YJ';
const WIDTHS = [1440, 768, 375];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
const probe = "(function(){ var card = document.querySelectorAll('.dc-stats-grid .dc-card')[0]; var tb = document.querySelector('.dc-stats-grid .dc-table'); var heads = tb ? Array.prototype.map.call(tb.querySelectorAll('.el-table__header-wrapper th .cell'), function (c) { return (c.innerText||'').trim() }) : []; var bw = tb ? tb.querySelector('.el-table__body-wrapper') : null; return JSON.stringify({ heads: heads, tableW: tb ? Math.round(tb.getBoundingClientRect().width) : 0, cardInnerW: card ? Math.round(card.clientWidth) : 0, bodyScrollW: bw ? bw.scrollWidth : 0, bodyClientW: bw ? bw.clientWidth : 0, docScrollW: document.documentElement.scrollWidth, winW: window.innerWidth }) })()";

async function main() {
  const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }) });
  const lj = await lr.json();
  if (!lj.data || !lj.data.token) { console.log('LOGIN_FAIL ' + JSON.stringify(lj).slice(0, 300)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {});
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_dcstatsw_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true });
  proc.unref(); await sleep(4000);
  let list; for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
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
  await ev('location.hash = "#/dc/stats"'); await sleep(5000);
  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: w === 375 ? 780 : 900, deviceScaleFactor: 1, mobile: false });
    await sleep(1800);
    console.log('W' + w + ' ' + await ev(probe));
    await shot('_dc-stats-w' + w + '.png');
  }
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)));
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) {}
  process.exit(0);
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) });
