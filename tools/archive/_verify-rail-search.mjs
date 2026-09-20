/**
 * _verify-rail-search.mjs — 左栏「单据选择」查找栏实测:只剩模糊搜索框(无部门下拉),查找/清空生效
 * 用法: node tools/archive/_verify-rail-search.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9389;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const PANEL = process.argv[2] || 'PURCHASE_IN';
const KW = process.argv[3] || 'TCGRK';

const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token, user = lj?.data?.user;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-railkw-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
if (!tab) throw new Error('Edge CDP 未就绪');
try {
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
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
  const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${PANEL}`;
  await send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.doc-select-rail .dsr-kw')`)) break; }
  await sleep(2000);

  const state = `(() => {
    const rail = document.querySelector('.doc-select-rail');
    const rows = [...rail.querySelectorAll('.dsr-grid tbody tr')].map((tr) => tr.children[0]?.textContent.trim()).filter((t) => t && t !== '暂无数据');
    return {
      selects: rail.querySelectorAll('.dsr-filters .el-select').length,
      ph: rail.querySelector('.dsr-kw input')?.placeholder || '',
      btn: rail.querySelector('.dsr-filters .el-button')?.textContent.trim() || '',
      count: rail.querySelector('.dsr-count')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      rows: rows.length, first: rows[0], allKw: rows.every((t) => true),
    };
  })()`;
  console.log(`=== ${PANEL} 左栏查找栏 ===`);
  let st = await ev(state);
  console.log('  初始:', JSON.stringify(st));
  ok(st.selects === 0, `查找栏已无「部门」下拉(实得 .el-select ${st.selects} 个)`);
  ok(st.ph === '模糊搜索', `输入框占位 = 模糊搜索(实得 ${JSON.stringify(st.ph)})`);
  ok(st.btn === '查找', `查找按钮在(实得 ${JSON.stringify(st.btn)})`);

  const type = (v) => ev(`(() => {
    const el = document.querySelector('.doc-select-rail .dsr-kw input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.doc-select-rail .dsr-filters .el-button').click();
    return 'ok';
  })()`);

  await type(KW); await sleep(1200);
  st = await ev(state);
  console.log(`  查找「${KW}」→`, JSON.stringify({ rows: st.rows, count: st.count, first: st.first }));
  ok(st.rows > 0 && st.rows < 50, `模糊搜索生效,本页只剩 ${st.rows} 行(原 50)`);
  ok((st.count || '').includes('本页筛出'), `计数注明「本页筛出」(${JSON.stringify(st.count)})`);

  await type(''); await sleep(1200);
  st = await ev(state);
  console.log('  清空 →', JSON.stringify({ rows: st.rows, count: st.count }));
  ok(st.rows === 50, `清空后恢复 50 行(实得 ${st.rows})`);

  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  const f = path.join(OUT, `railsearch-${PANEL}.png`);
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
  console.log('  截图:', f);
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
