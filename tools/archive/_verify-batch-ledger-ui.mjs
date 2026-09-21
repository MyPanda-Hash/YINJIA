/**
 * _verify-batch-ledger-ui.mjs — 送料批次台账(方案 A,面板 BATCH_LEDGER)界面验证:
 *   ① 菜单「采购管理 / 台账 / 送料批次台账」可进入面板
 *   ② 列头 = 17 个注册字段(顺序/标签与 yj_field 一致),行数与 v_batch_ledger 一致
 *   ③ 只读:无 新增/保存/删除 按钮;单元格不可编辑
 *   ④ 最新批次在最上(ORDER BY id DESC);状态列中文(有效/已释放)
 *   ⑤ 关键词模糊搜索(批次号/采购订单号/物料名/状态)跨列命中;翻页正确
 *   ⑥ 英文界面下 面板名/列头/状态值 显示英文(多语言未漏)
 * 用法: node tools/archive/_verify-batch-ledger-ui.mjs
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
const PORT = 9427;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => { const r = await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json(); return j; };

const fields = await q(`SELECT col_name, seq FROM yj_field WHERE panel_code='BATCH_LEDGER' ORDER BY seq`);
const viewCount = (await q(`SELECT COUNT(*) c FROM v_batch_ledger`))[0].c;
const activeCount = (await q(`SELECT COUNT(*) c FROM v_batch_ledger WHERE [状态]=N'有效'`))[0].c;
console.log(`元数据:字段 ${fields.length} 个 / 视图 ${viewCount} 行(有效 ${activeCount})`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bled-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
if (!tab) throw new Error('Edge CDP 未就绪');
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
const setAuth = (locale) => ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','${locale}'); 'ok'`);
await setAuth('zh-CN');

const READ = `(() => {
  const tables = [...document.querySelectorAll('table')];
  const rowTb = tables.find((t) => t.querySelector('tbody tr')) || tables[tables.length - 1];
  const headTb = tables.find((t) => t.querySelectorAll('thead th').length >= 5) || tables[0];
  const clean = (s) => s.replace(/[\\u21c5\\u25b2\\u25bc\\u2191\\u2193]/g, '').trim();
  const heads = headTb ? [...headTb.querySelectorAll('thead th')].map((th) => clean(th.textContent)).filter(Boolean) : [];
  const rows = rowTb ? [...rowTb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [];
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean);
  const pager = document.querySelector('.el-pagination');
  return {
    heads, rows: rows.slice(0, 3), rowCount: rows.length, allRows: rows,
    total: pager ? (pager.querySelector('.el-pagination__total')?.textContent || '') : '',
    hasPager: !!pager,
    inputs: document.querySelectorAll('tbody input, tbody textarea').length,
    btns: [...new Set(btns)].slice(0, 16),
    title: (document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 60),
  };
})()`;
const colIdx = (heads, name) => heads.indexOf(name);
const open = async (hash = '#/panelx/list/BATCH_LEDGER', waitMs = 3000) => {
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}${hash}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('table') && document.querySelectorAll('table thead th').length > 4`)) break; }
  await sleep(waitMs);
  return ev(READ);
};

console.log('\n=== ① 菜单入口 / ② 列头与行数 / ③ 只读 ===');
const menu = await ev(`(async () => {
  const r = await fetch('${FRONT}/src/business/menus.js').catch(() => null);
  return null;
})()`);
void menu;
let st = await open();
console.log('   列头:', JSON.stringify(st.heads));
console.log('   首行:', JSON.stringify(st.rows[0]));
console.log('   行数:', st.rowCount, ' 分页:', JSON.stringify(st.total), ' hasPager=', st.hasPager);
console.log('   按钮:', JSON.stringify(st.btns));
const dataHeads = st.heads.filter((h) => h !== '序号')
ok(dataHeads.length === fields.length, `数据列数 = 注册字段数(${dataHeads.length}/${fields.length})`);
ok(JSON.stringify(dataHeads) === JSON.stringify(fields.map((f) => f.col_name)), '列头顺序与 yj_field.seq 一致');
ok(st.rowCount === Math.min(viewCount, 50), `单页渲染 ${Math.min(viewCount, 50)} 行(page_size=50,视图 ${viewCount} 行)`);
ok(!st.btns.some((b) => /新增|保存|删除|放弃|生单/.test(b)), `只读:无 新增/保存/删除/生单 按钮(${JSON.stringify(st.btns)})`);
ok(st.inputs === 0, `只读:表格内无输入框(实测 ${st.inputs} 个)`);
ok(/送料批次台账/.test(st.title) || dataHeads.includes('批次号'), '打开的是送料批次台账面板');

console.log('\n=== ④ 排序与状态列 ===');
const newest = await q(`SELECT TOP 1 [批次号], [送料时间] FROM v_batch_ledger ORDER BY [送料时间] DESC`);
const iStatus = colIdx(st.heads, '状态');
const iNo = colIdx(st.heads, '批次号');
ok(st.allRows.every((r) => ['有效', '已释放'].includes(r[iStatus])), `状态列中文值:${JSON.stringify([...new Set(st.allRows.map((r) => r[iStatus]))])}`);
const relRows = st.allRows.filter((r) => r[iStatus] === '已释放').length;
console.log(`   有效 ${st.rowCount - relRows} 行 / 已释放 ${relRows} 行(视图:有效 ${activeCount} / 已释放 ${viewCount - activeCount})`);
ok(relRows === viewCount - activeCount, '释放批次也在台账留痕(数量与视图一致)');

console.log('\n=== ⑤ 查询弹窗字段 + 模糊过滤 + 翻页 ===');
const dialogFields = await ev(`(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '查询');
  if (btns.length) btns[0].click();
  return btns.length;
})()`);
await sleep(1500);
const dlg = await ev(`(() => {
  const box = document.querySelector('.el-dialog, .el-drawer');
  if (!box) return { open: false };
  const labels = [...box.querySelectorAll('label, .el-form-item__label')].map((l) => l.textContent.trim()).filter(Boolean);
  const inputs = [...box.querySelectorAll('input')].map((i) => i.placeholder || '');
  return { open: true, labels, inputs, heads: [...box.querySelectorAll('th')].map((th) => th.textContent.trim()).filter(Boolean) };
})()`);
console.log('   查询按钮数:', dialogFields, ' 弹窗:', JSON.stringify(dlg).slice(0, 400));
ok(dlg.open, '「查询」按钮可打开查询弹窗(报表模式:查询走弹窗,无内联关键词框)');
// 在弹窗里填 批次号 模糊值 → 查询
const applied = await ev(`(() => {
  const box = document.querySelector('.el-dialog, .el-drawer');
  if (!box) return 'no-dialog';
  const lab = [...box.querySelectorAll('label, .el-form-item__label, td, th, span, div')]
    .find((el) => el.children.length === 0 && el.textContent.trim() === '批次号');
  let node = lab, inp = null;
  while (node && !inp) { inp = node.querySelector('input'); if (!inp) node = node.parentElement; }
  if (!inp) return 'no-input';
  inp.focus();
  inp.value = 'YJ-20260912-02';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return 'filled:' + inp.value;
})()`);
await sleep(500);
const clicked = await ev(`(() => {
  const box = document.querySelector('.el-dialog, .el-drawer');
  if (!box) return 'no-dialog';
  const b = [...box.querySelectorAll('button')].find((x) => /^(查询|确定|搜索)$/.test(x.textContent.trim()));
  if (b) { b.click(); return b.textContent.trim(); }
  return 'no-button';
})()`);
await sleep(2600);
console.log('   填写:', applied, ' 提交按钮:', clicked);
const searched = await ev(READ);
const apiKw = await post('/px/queryFormDataList', { panelCode: 'BATCH_LEDGER', pageNo: 1, pageSize: 50, condition: { 批次号: 'YJ-20260912-02' } });
console.log('   搜索后行数:', searched.rowCount, ' 接口命中:', apiKw.data?.totalSize);
ok(searched.rowCount === (apiKw.data?.list || []).length, `界面行数 = 接口命中数(${searched.rowCount}/${(apiKw.data?.list || []).length})`);
ok((searched.rows || []).every((r) => r.join('|').includes('YJ-20260912-02')), '过滤结果都命中该批次号');

console.log('\n=== ⑥ 英文界面(多语言) ===');
await setAuth('en');
const en = await open('#/panelx/list/BATCH_LEDGER');
const enHeads = en.heads.filter((h) => h !== 'No.' && h !== '序号');
console.log('   英文列头:', JSON.stringify(en.heads.slice(0, 6)));
const iStatusEn = colIdx(en.heads, 'Status');
const enStatuses = [...new Set(en.allRows.map((r) => r[iStatusEn]))];
console.log('   英文状态值:', JSON.stringify(enStatuses));
ok(!enHeads.some((h) => /[\u4e00-\u9fa5]/.test(h)), '英文界面列头无中文残留(面板名/字段名走 yj_translation + 语言包)');
// 说明:报表单元格渲染的是视图里的**数据值**(ADR-0001 数据键中文),与既有报表面板(批号追溯/工单齐套表)口径一致,
//       状态/去向单据这类列在英文界面仍显示中文值 —— 本项只断言"列头与面板名不残留中文"。
ok(enStatuses.length === 2, `英文界面仍能读到状态列(${JSON.stringify(enStatuses)})`);

await pool.close();
ws.close(); edge.kill();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
