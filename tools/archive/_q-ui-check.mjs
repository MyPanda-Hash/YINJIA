/** 临时:改前 UI 基线 —— 打开 YJ-20260915-11 送料浮层,读每行去向单号,并点「查看」看目标面板是否有数据 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = process.env.YJ_FRONT || 'http://localhost:8090';
const CDP_PORT = Number(process.env.YJ_CDP_PORT || 9466);
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()).data;
const PO = 'YJ-20260915-11';
const rows = ((await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO })).batches) || [];
console.log('接口行:');
console.table(rows.map((r) => ({ batchId: r.batchId, 批次号: r.batchNo, 起点: `${r.firstTargetPanel}/${r.firstTargetFormNo}`, 去向: `${r.targetPanel}/${r.targetFormNo}`, hops: r.targetHops })));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch { /* wait */ }
}
if (!tab) { console.error('Edge CDP 未就绪'); edge.kill(); process.exit(1); }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` });
await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO)}` });
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.batch-sum-line')`)) break; }
await sleep(2000);
await ev(`document.querySelector('.batch-sum-line').click(), 'ok'`);
await sleep(2200);
const READ = `(() => {
  const pop = document.querySelector('.batch-pop-body');
  const tb = pop ? pop.querySelector('.el-table__body-wrapper table') : null;
  return { rows: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\\s+/g,' ').trim())) : [],
           disabled: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => !!tr.querySelector('.el-button')?.disabled) : [] };
})()`;
const st = await ev(READ);
console.log('界面行:'); console.table(st.rows); console.log('查看按钮 disabled=' + JSON.stringify(st.disabled));

// 逐行点「查看」,记录跳转目标与目标页是否有数据
for (let i = 0; i < st.rows.length; i++) {
  const cell = st.rows[i][4];
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO)}` });
  for (let k = 0; k < 60; k++) { await sleep(400); if (await ev(`!!document.querySelector('.batch-sum-line')`)) break; }
  await sleep(1500);
  await ev(`document.querySelector('.batch-sum-line').click(), 'ok'`);
  await sleep(1800);
  const clicked = await ev(`(() => { const tr = document.querySelectorAll('.batch-pop-body .el-table__body-wrapper tbody tr')[${i}]; const b = tr && tr.querySelector('.el-button'); if (!b || b.disabled) return 'disabled'; b.click(); return 'clicked'; })()`);
  if (clicked === 'disabled') { console.log(`行${i + 1} 去向=${cell} → 按钮禁用(未点击)`); continue; }
  await sleep(3500);
  const info = await ev(`(() => {
    const btns = [...document.querySelectorAll('.tools-right .doc-no, .tools-right input, .tools-right *')].map((e) => e.value || '').filter(Boolean);
    const gridRows = document.querySelectorAll('.el-table__body-wrapper tbody tr').length;
    return { hash: location.hash, body: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 300), gridRows, vals: btns.slice(0, 6) };
  })()`);
  console.log(`行${i + 1} 去向=${cell} → ${info.hash}`);
  console.log(`     列表行数=${info.gridRows} 正文前 200:${String(info.body).slice(0, 200)}`);
}
try { ws.close(); } catch { /* ignore */ }
edge.kill();
