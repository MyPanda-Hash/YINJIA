/**
 * _verify-chain-insp-fields.mjs — 采购链字段流转修复 ② 验证
 *   ① 检验单「暂收单号」:面板映射已登记(单号→暂收单号)+ 存量回填覆盖
 *   ② 采购入库行「是否来料检验」:由来源判定 —— 检验单来源=是 / 采购订单免检直达=否
 *      · 映射/推式/分批路径:PushGenerateHandler.applyInspectionFlag
 *      · 审核自动生单路径:ButtonService.inspAutoPurchaseIn(检验→入库)
 *   ③ 实测生成:用采购订单走「免检直达入库」分批生单 → 新入库行应为「否」;并复核既有「是」的行来自检验链
 *   ④ 界面:采购入库单明细列出现「是否来料检验」且有值
 * 用法: node tools/archive/_verify-chain-insp-fields.mjs [采购订单号]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9463;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => (await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());

console.log('=== ① 检验单「暂收单号」===');
const cfgInsp = (await (await fetch(API + '/px/getPanelConfig?panelCode=QC_INSP', { headers: H })).json()).data;
const hmap = (cfgInsp?.selectConfig?.headerMap || []).map((m) => `${m.from}→${m.to}`);
console.log('   暂收→检验 头映射:', JSON.stringify(hmap));
ok(hmap.includes('单号→暂收单号'), '映射表已登记 单号→暂收单号(选单/推式路径)');
const inspStat = (await q(`SELECT COUNT(*) total, SUM(CASE WHEN ISNULL([暂收单号],N'')<>N'' THEN 1 ELSE 0 END) filled FROM qc_insp`))[0];
console.log(`   暂收单号覆盖:${inspStat.filled}/${inspStat.total}`);
ok(inspStat.filled === inspStat.total - 1, `存量已回填(仅无上游暂收单的 1 张老单为空)`);
const linkMismatch = await q(`
SELECT COUNT(*) c FROM qc_insp i
 LEFT JOIN (SELECT DISTINCT target_form_no, source_form_no FROM form_flow_link WHERE source_panel_code='QC_RECV' AND target_panel_code='QC_INSP') l
   ON l.target_form_no = i.[单据编号]
 WHERE ISNULL(i.[暂收单号],N'') <> N'' AND l.source_form_no IS NOT NULL AND i.[暂收单号] <> l.source_form_no`);
ok(linkMismatch[0].c === 0, '暂收单号与链路台账来源单号逐行一致');

console.log('\n=== ② 是否来料检验:分布与来源对应 ===');
const dist = await q(`SELECT ISNULL([是否来料检验],N'(空)') v, COUNT(*) c FROM bl_purchase_in GROUP BY [是否来料检验]`);
console.log('   分布:', JSON.stringify(dist));
ok(dist.every((d) => d.v !== '(空)'), '入库行全部有值(无空值)');
const yesDoc = await q(`SELECT TOP 3 h.[单据编号],
   CASE WHEN EXISTS (SELECT 1 FROM form_flow_link l WHERE l.target_form_no=h.[单据编号] AND l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP') THEN N'QC_INSP' END AS insp_src,
   CASE WHEN EXISTS (SELECT 1 FROM form_flow_link l WHERE l.target_form_no=h.[单据编号] AND l.link_status='ACTIVE' AND l.source_panel_code='PU_ORDER') THEN N'PU_ORDER' END AS po_src
 FROM bd_purchase_in h WHERE EXISTS (SELECT 1 FROM bl_purchase_in p WHERE p.[单据编号]=h.[单据编号] AND p.[是否来料检验]=N'是')`);
console.log('   标「是」的单据来源:', JSON.stringify(yesDoc));
ok(yesDoc.every((r) => !r.po_src || r.insp_src), '标「是」的入库单来源都含检验单');
const badYes = await q(`
SELECT COUNT(*) c FROM bl_purchase_in p
 JOIN bd_purchase_in h ON h.[单据编号]=p.[单据编号]
 WHERE p.[是否来料检验]=N'是' AND EXISTS (SELECT 1 FROM form_flow_link l WHERE l.target_form_no=p.[单据编号] AND l.link_status='ACTIVE')
   AND NOT EXISTS (SELECT 1 FROM form_flow_link l WHERE l.target_form_no=p.[单据编号] AND l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP')`);
ok(badYes[0].c === 0, '没有「有链路但来源不是检验单却标是」的行');

console.log('\n=== ③ 实测:采购订单免检直达入库 → 是否来料检验=否 ===');
// 找一个「还有可入库剩余量」的采购订单(逐个试,避免挑到已全量入库的单)
let PO = process.argv[2], line = null, lines = null;
const cands = process.argv[2] ? [process.argv[2]]
  // 生单闸门认的是**后端单据状态**(yj_doc_status),与表内列可能不一致 → 用面板列表取"已审核"的订单
  : ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).data?.list || [])
      .filter((r) => String(r['单据状态']) === '已审核').map((r) => String(r['单据编号'])).slice(0, 30);
for (const cand of cands) {
  lines = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'PURCHASE_IN', sourceNo: cand });
  line = (lines.data?.lines || []).find((l) => Number(l.剩余数量) > 0);
  if (line) { PO = cand; break; }
}
if (!line) {
  console.log('   [SKIP] 试过的订单都没有可入库剩余量,跳过实测生成');
} else {
  const qty = Math.min(1, Number(line.剩余数量));
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'PURCHASE_IN', sourceNo: PO,
    lines: [{ lineKey: line.lineKey, qty }],
  });
  const newNo = gen.data?.编号;
  console.log(`   生成入库单 ${newNo}(免检直达,来源=采购订单 ${PO})`);
  const rows = await q(`SELECT [存货编码],[实收数量],[是否来料检验] FROM bl_purchase_in WHERE [单据编号]=N'${newNo}'`);
  console.log('   新入库行:', JSON.stringify(rows));
  ok(rows.length > 0 && rows.every((r) => r['是否来料检验'] === '否'), `采购订单直达生成的入库行 = 否(实测 ${JSON.stringify(rows.map((r) => r['是否来料检验']))})`);
}

console.log('\n=== ④ 界面:采购入库单明细列「是否来料检验」 ===');
const sample = (await q(`SELECT TOP 1 [单据编号] no FROM bd_purchase_in WHERE EXISTS (SELECT 1 FROM bl_purchase_in p WHERE p.[单据编号]=bd_purchase_in.[单据编号] AND p.[是否来料检验]=N'是') ORDER BY [单据编号] DESC`))[0]?.no;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cif-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {} }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PURCHASE_IN?docNo=${encodeURIComponent(sample)}` });
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.detail')`)) break; }
await sleep(2600);
const ui = await ev(`(() => {
  const heads = [...document.querySelectorAll('.detail thead th')].map((th) => th.textContent.replace(/[\\u21c5\\u25b2\\u25bc]/g,'').trim());
  const i = heads.indexOf('是否来料检验');
  const tb = document.querySelector('.detail .el-table__body-wrapper table');
  const rows = tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [];
  // 明细表在可编辑时会补空白占位行 → 只统计"有内容的行"
  const filled = rows.filter((r) => r.some((c) => c !== ''));
  return { heads, idx: i, values: i >= 0 ? filled.map((r) => r[i]) : [], rawRows: rows.length, filledRows: filled.length };
})()`);
console.log(`   入库单 ${sample} 列头:`, JSON.stringify(ui.heads));
console.log('   是否来料检验 列值:', JSON.stringify(ui.values));
ok(ui.idx >= 0, '明细列包含「是否来料检验」');
ok(ui.values.length > 0 && ui.values.every((v) => v === '是' || v === '否'), `列值已填(${JSON.stringify([...new Set(ui.values)])})`);

console.log('\n=== ⑤ 全链实测:采购订单 → 暂收单 → 检验单 → 采购入库单 ===');
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
// 挑一张"后端状态=已审核且仍有可送量"的采购订单
let e2ePo = null, e2eLine = null;
for (const cand of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).data?.list || [])
  .filter((r) => String(r['单据状态']) === '已审核').map((r) => String(r['单据编号'])).slice(0, 30)) {
  const ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: cand });
  const l = (ls.data?.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (l) { e2ePo = cand; e2eLine = l; break; }
}
if (!e2ePo) {
  console.log('   [SKIP] 没有"已审核且还有可送量"的采购订单,跳过全链实测');
} else {
  const qty = Math.min(1, Number(e2eLine.剩余数量));
  const recvNo = (await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: e2ePo, lines: [{ lineKey: e2eLine.lineKey, qty }] })).data?.编号;
  console.log(`   ① 采购订单 ${e2ePo} → 暂收单 ${recvNo}(本次 ${qty})`);
  await cb('QC_RECV', '审核', { 编号: recvNo });
  await sleep(1200);
  const inspGen = await cb('QC_RECV', '生成来料检验单', { 编号: recvNo });
  const inspNo = inspGen.data?.编号 || inspGen.data?.data?.编号;
  console.log(`   ② 暂收单 → 检验单 ${inspNo}`);
  const inspHead = (await q(`SELECT [暂收单号],[采购订单号],[批次号] FROM qc_insp WHERE [单据编号]=N'${inspNo}'`))[0] || {};
  console.log('   ③ 检验单头:', JSON.stringify(inspHead));
  ok(String(inspHead['暂收单号'] || '') === String(recvNo), `检验单「暂收单号」= 暂收单号(实测 ${inspHead['暂收单号']})`);
  const inspLines = await q(`SELECT [物料编码],[规格型号],[送检数量],[数量] FROM qc_insp_detail WHERE [单据编号]=N'${inspNo}'`);
  console.log('   检验行:', JSON.stringify(inspLines));
  ok(inspLines.length > 0 && inspLines.every((r) => String(r['规格型号'] || '') !== ''), '检验行规格型号已流转');
  ok(inspLines.every((r) => Number(r['送检数量']) === qty), `检验行送检数量 = 本次送料量(${qty})`);
  // 让自动生单有合格数量可依(检验单是草稿,直接补合格数量,模拟检验完成)
  await q(`UPDATE qc_insp_detail SET [合格数量] = [送检数量] WHERE [单据编号]=N'${inspNo}'`);
  const appro = await cb('QC_INSP', '审核', { 编号: inspNo });
  console.log('   ④ 审核检验单:', JSON.stringify(appro).slice(0, 120));
  await sleep(1500);
  const piNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${inspNo}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))[0]?.no;
  console.log(`   ⑤ 自动生成的采购入库单: ${piNo}`);
  const piRows = piNo ? await q(`SELECT [存货编码],[规格型号],[实收数量],[是否来料检验] FROM bl_purchase_in WHERE [单据编号]=N'${piNo}'`) : [];
  console.log('   入库行:', JSON.stringify(piRows));
  ok(!!piNo, '审核检验单 → 自动生成采购入库单');
  ok(piRows.length > 0 && piRows.every((r) => r['是否来料检验'] === '是'), `经检验单生成的入库行 = 是(实测 ${JSON.stringify(piRows.map((r) => r['是否来料检验']))})`);
  ok(piRows.every((r) => String(r['规格型号'] || '') !== '' && Number(r['实收数量']) === qty), '入库行规格型号/实收数量 = 检验合格量');
}
await pool.close(); ws.close(); edge.kill();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
