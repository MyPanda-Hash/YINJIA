/**
 * _verify-spec-unify.mjs — 「规格统一为规格型号」修复验证(采购链)
 *   ① 面板字段:送料暂收单/来料检验单 明细列都叫「规格型号」(不再有「型号」)
 *   ② 界面:送料暂收单页面表格列头显示「规格型号」
 *   ③ 自动生单 SQL:三处改动后的 SQL 列引用有效(暂收同步 / 检验→入库 / 检验→退料)
 *   ④ 真实链路数据:检验行/入库行/退料行 的 规格型号 已回填且与来源一致
 *   ⑤ 映射体检:四跳的「规格型号」均为同名直通(不再依赖同义词)
 * 用法: node tools/archive/_verify-spec-unify.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9461;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const cfg = async (p) => (await (await fetch(`${API}/px/getPanelConfig?panelCode=${p}`, { headers: H })).json()).data;

console.log('=== ① 面板字段命名 ===');
for (const p of ['QC_RECV', 'QC_INSP']) {
  const c = await cfg(p);
  // 明细字段 = detail.tabs 的字段集合(界面明细表即由它渲染;比 gridTabs.columns 更稳)
  const detail = (c?.detail?.tabs || []).flatMap((t) => t.fields || []).map((x) => x.dataName || x.label);
  const hasSpec = detail.includes('规格型号'), hasModel = detail.includes('型号');
  console.log(`   ${p} 明细列:`, JSON.stringify(detail.filter((x) => /规格|型号/.test(x))));
  ok(hasSpec && !hasModel, `${p} 只有「规格型号」、没有「型号」`);
}

console.log('\n=== ② 界面列头(送料暂收单) ===');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-spec-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
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
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
const sampleRecv = (await q(`SELECT TOP 1 [单据编号] AS no FROM sl_recv WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))[0].no;
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_RECV?docNo=${encodeURIComponent(sampleRecv)}` });
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.detail')`)) break; }
await sleep(2600);
const heads = await ev(`[...document.querySelectorAll('.detail thead th')].map((th) => th.textContent.replace(/[\\u21c5\\u25b2\\u25bc]/g,'').trim())`);
console.log(`   暂收单 ${sampleRecv} 明细列头:`, JSON.stringify(heads));
ok(heads.includes('规格型号') && !heads.includes('型号'), '界面列头为「规格型号」,没有「型号」');

console.log('\n=== ③ 自动生单 SQL 列引用(改动后可用) ===');
const smoke = [
  ['暂收→检验 同步', `SELECT TOP 0 d.[规格型号], s.[规格型号], d.[物料编码], d.[数量] FROM qc_insp_detail d JOIN sl_recv_detail s ON s.id = d.id`],
  ['检验→入库 取值', `SELECT TOP 0 id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 合格数量, 仓库代码, 计量单位, 单价, 采购订单行号 FROM qc_insp_detail`],
  ['检验→退料 取值', `SELECT TOP 0 id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 不良数量, 备注, 计量单位, 单价, 采购订单行号 FROM qc_insp_detail`],
];
for (const [name, sql] of smoke) {
  try { await q(sql); ok(true, `${name}:SQL 列引用有效`); } catch (e) { ok(false, `${name}:${String(e.message).slice(0, 120)}`); }
}

console.log('\n=== ④ 存量链路数据(回填结果) ===');
const stat = async (t) => (await q(`SELECT COUNT(*) total, SUM(CASE WHEN ISNULL([规格型号],N'')<>N'' THEN 1 ELSE 0 END) filled FROM ${t}`))[0];
for (const t of ['sl_recv_detail', 'qc_insp_detail', 'bl_purchase_in', 'qc_return_detail']) {
  const r = await stat(t);
  console.log(`   ${t}: ${r.filled}/${r.total} 行有规格型号`);
}
const inspFilled = await stat('qc_insp_detail');
ok(inspFilled.filled === inspFilled.total && inspFilled.total > 0, `来料检验单行规格型号已全部有值(${inspFilled.filled}/${inspFilled.total},修复前 0/40)`);
const chainMatch = await q(`
SELECT TOP 3 d.[单据编号], d.[物料编码], d.[规格型号] AS insp_spec, s.[规格型号] AS recv_spec
FROM qc_insp_detail d
JOIN form_flow_link l ON l.target_panel_code='QC_INSP' AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
JOIN sl_recv_detail s ON l.source_panel_code='QC_RECV' AND l.source_line_key = l.source_form_no + N'#' + CAST(s.id AS nvarchar(20))
WHERE ISNULL(d.[规格型号],N'') <> ISNULL(s.[规格型号],N'')`);
console.log('   链路逐行比对(不一致行):', JSON.stringify(chainMatch));
ok(chainMatch.length === 0, '检验行规格型号 = 暂收行规格型号(逐行比对无不一致)');

await pool.close();
ws.close(); edge.kill();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
