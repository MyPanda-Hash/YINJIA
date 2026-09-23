/** 临时:直接以 ?docNo= 打开 QC_RETURN / QC_RECV 面板,看目标单据是否定位到(表单是否出来) */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = process.env.YJ_FRONT || 'http://localhost:8090';
const CDP_PORT = Number(process.env.YJ_CDP_PORT || 9467);
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui2-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch { /* wait */ } }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

for (const [panel, no] of [['QC_RETURN', 'TH-2026-09-0010'], ['QC_RETURN', 'TH-2026-09-0003'], ['QC_RECV', 'SL-2026-09-0041'], ['QC_RECV', 'SL-2026-09-0034']]) {
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(no)}` });
  await sleep(6000);
  const r = await ev(`(() => {
    const inputs = [...document.querySelectorAll('.header-fields input, .tools-right input')].map((e) => e.value).filter(Boolean);
    const rows = document.querySelectorAll('.body .el-table__body-wrapper tbody tr').length;
    const empty = (document.querySelector('.el-table__empty-text')?.textContent || '').trim();
    const txt = (document.body.innerText || '').replace(/\\s+/g,' ');
    return { hash: location.hash, inputs, rows, empty, hasNo: txt.includes(${JSON.stringify(no)}), snippet: txt.slice(0, 0) };
  })()`);
  console.log(`${panel} ?docNo=${no} → hash=${r.hash} 页面出现该单号=${r.hasNo} 明细行数=${r.rows} 空提示=${JSON.stringify(r.empty)} 表头值=${JSON.stringify(r.inputs.slice(0, 8))}`);
}
try { ws.close(); } catch { /* ignore */ }
edge.kill();
