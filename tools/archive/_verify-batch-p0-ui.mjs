/**
 * _verify-batch-p0-ui.mjs — 分批送料 P0 界面实测:
 *   ① 采购订单工具栏「生成送料暂收单」不再直接生成,而是弹出「分批送料」对话框
 *   ② 对话框内容:行(订单数量/已送/已退回/剩余/可送上限)+ 批次号 + 超送比例 + 已有批次
 *   ③ 填本次数量 → 确定生单 → 生成草稿(带批次号)并跳转目标面板
 *   ④ 收尾:把测试生成的草稿作废(不留脏数据)
 * 用法: node tools/archive/_verify-batch-p0-ui.mjs [采购订单号]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9409;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const PO = process.argv[2] || 'YJ-20260916-01';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = login?.data?.token, user = login?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
let createdNo = null;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-batch-'));
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

  const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO)}`;
  await send('Page.navigate', { url });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right')`)) break; }
  await sleep(2500);
  console.log(`\n=== ① 采购订单 ${PO} 点「生成送料暂收单」===`);
  // 工具条诊断:生单组主按钮 + 下拉项(生成送料暂收单 通常在「生单」组的下拉里)
  const toolbar = await ev(`(() => {
    const tools = document.querySelector('.tools');
    const groups = [...document.querySelectorAll('.tb-group')].map((g) => ({
      main: g.querySelector('.tb-main')?.textContent.trim() || '',
      caret: !!g.querySelector('.tb-caret'),
    }));
    return { text: (tools?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 240), groups };
  })()`);
  console.log('  工具条:', JSON.stringify(toolbar));
  let clicked = await ev(`(() => {
    const b = [...document.querySelectorAll('.tb-main, .tb-menu .ctx-item')].find((x) => /生成送料暂收单/.test(x.textContent || ''));
    if (!b) return 'no-direct';
    b.click(); return 'direct';
  })()`);
  if (clicked === 'no-direct') {
    // 打开「生单」组下拉再点(下拉是 v-if 渲染,分两步 eval)
    await ev(`(() => {
      const g = [...document.querySelectorAll('.tb-group')].find((x) => /生单/.test(x.querySelector('.tb-main')?.textContent || ''));
      g?.querySelector('.tb-caret')?.click();
      return 'ok';
    })()`);
    await sleep(500);
    clicked = await ev(`(() => {
      const b = [...document.querySelectorAll('.tb-menu .ctx-item')].find((x) => /生成送料暂收单/.test(x.textContent || ''));
      if (!b) return 'no-menu';
      b.click(); return 'menu';
    })()`);
  }
  ok(clicked === 'direct' || clicked === 'menu', `点击「生成送料暂收单」(${clicked})`);
  let dlg = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    dlg = await ev(`(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
      if (!d) return null;
      const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => th.textContent.trim()).filter(Boolean);
      const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
      return { title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), bar: (d.querySelector('.bsd-bar')?.textContent || '').replace(/\\s+/g, ' ').trim(), heads, rows, inputs: d.querySelectorAll('input').length };
    })()`);
    if (dlg) break;
  }
  console.log('  对话框:', JSON.stringify(dlg && { title: dlg.title, bar: dlg.bar, heads: dlg.heads, rows: dlg.rows.slice(0, 2), inputs: dlg.inputs }));
  ok(!!dlg, '弹出「分批送料」对话框(不再直接整单生成)');
  if (!dlg) throw new Error('分批对话框未出现');
  ok(/批次号/.test(dlg.bar || ''), `对话框显示自动批次号(${dlg.bar})`);
  ok(/超送比例/.test(dlg.bar || ''), '对话框显示超送比例');
  ok(dlg.heads.some((h) => /本次送料数量/.test(h)), '表格含「本次送料数量」可填列');
  ok(dlg.heads.some((h) => /剩余/.test(h)) && dlg.heads.some((h) => /已送/.test(h)), '表格含 已送/剩余 列');

  console.log('\n=== ② 填本次数量 100 并确定生单 ===');
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
    const input = d.querySelector('.el-table__body tbody tr input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, '100');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value;
  })()`);
  await sleep(600);
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
    const b = [...d.querySelectorAll('.el-dialog__footer .el-button')].find((x) => /确定生单/.test(x.textContent));
    b.click(); return 'ok';
  })()`);
  await sleep(4000);
  const after = await ev(`({ href: location.href, chip: document.querySelector('.doc-chip')?.textContent.trim() || '', batch: (document.querySelector('.fields')?.textContent||'').match(/批次号[^\\s]{0,40}/)?.[0] || '' })`);
  console.log('  生单后:', JSON.stringify(after));
  createdNo = String(after.chip || '').replace(/^单据：/, '').trim();
  const row = await q(`SELECT 单据编号, 批次号, 采购订单号 FROM sl_recv WHERE 单据编号 = N'${createdNo}'`);
  console.log('  库里:', JSON.stringify(row));
  ok(!!row[0], `生成暂收单 ${createdNo} 已入库`);
  ok(String(row[0]?.批次号 || '').startsWith(PO + '-'), `暂收单批次号 = ${row[0]?.批次号}`);
  ok(String(row[0]?.采购订单号) === PO, '暂收单带采购订单号');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  fs.writeFileSync(path.join(OUT, `batch-send-dialog.png`), Buffer.from(shot.result.data, 'base64'));

  console.log('\n=== ③ 收尾:作废测试草稿 ===');
  if (createdNo) {
    const r = await fetch(API + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'SL_RECV', buttonName: '删除', formData: { 编号: createdNo }, buttonParam: {} }) });
    const j = await r.json();
    console.log(`  删除 ${createdNo}: ${j.code === 0 || j.code === 200 ? 'ok' : j.message}`);
    const st = await q(`SELECT ISNULL(canceled,'N') c FROM yj_doc_status WHERE panel_code='SL_RECV' AND doc_no=N'${createdNo}'`);
    ok(st[0]?.c === 'Y', '测试草稿已作废(不留脏数据)');
  }
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  await pool.close();
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
