/**
 * _verify-batch-tab-ui.mjs — 采购订单「送料批次」页签(方案 B)界面验证:
 *   ① 已审核订单:出现「送料批次」页签;点开才发一次 /px/batchFlow/lines(懒加载,首屏 0 请求)
 *   ② 页签内容 = 台账批次行(批次号/日期/数量/状态/暂收单)+ 底部汇总(已送 N 批次数 · 已送合计 · 剩余 · 已退回)
 *   ③ 点「查看」跳转到该批次生成的送料暂收单(QC_RECV)
 *   ④ 已审核但从未送料的订单:页签显示「该订单暂无送料批次」
 *   ⑤ 未审核订单:不出现该页签
 * 用法: node tools/archive/_verify-batch-tab-ui.mjs
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
const PORT = 9421;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => { const r = await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 200)}`); return j.data; };

// ── 选样:① 有有效批次的已审核订单 ② 无批次的已审核订单 ③ 未审核订单 ──
const meta = (await q(`SELECT head_table, group_col FROM yj_panel WHERE panel_code='PU_ORDER'`))[0];
const T = meta.head_table.replace(/[^0-9A-Za-z_]/g, ''), GC = meta.group_col;
const withBatch = (await q(`SELECT TOP 1 source_form_no AS no FROM yj_doc_batch WHERE source_panel_code='PU_ORDER' AND status='ACTIVE' GROUP BY source_form_no ORDER BY COUNT(*) DESC`))[0]?.no;
const noBatch = (await q(`SELECT TOP 1 t.[${GC}] AS no FROM ${T} t WHERE t.[单据状态]=N'已审核' AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b WHERE b.source_panel_code='PU_ORDER' AND b.source_form_no=t.[${GC}]) ORDER BY t.[${GC}] DESC`))[0]?.no;
const draft = (await q(`SELECT TOP 1 t.[${GC}] AS no FROM ${T} t WHERE t.[单据状态]<>N'已审核' ORDER BY t.[${GC}] DESC`))[0]?.no;
console.log(`样本: 有批次=${withBatch} 已审核无批次=${noBatch} 未审核=${draft}`);
if (!withBatch) { console.log('[SKIP] 库中无带有效批次的采购订单'); await pool.close(); process.exit(0); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-btab-'));
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
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

const READ = `(() => {
  const heads = [...document.querySelectorAll('.detail .dt-tab')].map((s) => s.textContent.trim());
  const bt = [...document.querySelectorAll('.detail .dt-tab')].find((s) => s.textContent.trim().startsWith('送料批次'));
  const box = document.querySelector('.batch-tab');
  const tb = box ? box.querySelector('.el-table__body-wrapper table') : null;
  const hd = box ? box.querySelector('.el-table__header-wrapper table') : null;
  return {
    tabs: heads,
    hasBatchTab: !!bt,
    activeBatch: !!box,
    sum: box ? (box.parentElement.querySelector('.batch-sum')?.textContent.replace(/\\s+/g,' ').trim() || '') : '',
    colHeads: hd ? [...hd.querySelectorAll('thead th')].map((th) => th.textContent.trim()).filter(Boolean) : [],
    rows: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [],
    empty: box ? (box.querySelector('.el-table__empty-text')?.textContent.trim() || '') : '',
    linesCalls: performance.getEntriesByType('resource').filter((r) => r.name.includes('batchFlow/lines')).length,
  };
})()`;

const firstPaint = [] // 面板首屏耗时(ms):用于回答「加页签会不会拖慢启动」
async function openPanel(docNo) {
  const t0 = Date.now()
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(docNo)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right') && !!document.querySelector('.detail')`)) break; }
  firstPaint.push(`PU_ORDER/${docNo}: ${Date.now() - t0}ms`)
  await sleep(2600);
  return ev(READ);
}
async function openPanel2(panel, docNo) {
  const t0 = Date.now()
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right') && !!document.querySelector('.detail')`)) break; }
  firstPaint.push(`${panel}/${docNo}: ${Date.now() - t0}ms`)
  await sleep(2600);
  return ev(READ);
}
const clickBatchTab = async () => { await ev(`[...document.querySelectorAll('.detail .dt-tab')].find((s) => s.textContent.trim().startsWith('送料批次'))?.click(), 'ok'`); await sleep(2200); };

// ── ① 已审核 + 有批次 ──
console.log(`\n=== ① 已审核且有批次:${withBatch} ===`);
const apiBatches = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: withBatch });
let st = await openPanel(withBatch);
ok(st.hasBatchTab, `页签出现: ${JSON.stringify(st.tabs)}`);
ok(st.linesCalls === 0, `首屏未请求批次数据(batchFlow/lines 调用=${st.linesCalls},懒加载)`);
await clickBatchTab();
st = await ev(READ);
ok(st.activeBatch, '点开后显示送料批次表');
ok(st.linesCalls === 1, `点开页签共 1 次请求(=${st.linesCalls})`);
console.log('   列头:', JSON.stringify(st.colHeads));
console.log('   行:', JSON.stringify(st.rows.slice(0, 3)));
console.log('   汇总:', JSON.stringify(st.sum));
ok(st.colHeads.join('|') === '批次号|日期|数量|状态|暂收单|操作', '列头 = 批次号/日期/数量/状态/暂收单/操作');
ok(st.rows.length === (apiBatches.batches || []).length, `行数 = 台账有效批次数(${st.rows.length}/${(apiBatches.batches || []).length})`);
ok(st.rows.every((r) => r[0] === withBatch + '-' || /^.+-\d{3}$/.test(r[0])), '每行批次号形如 单号-3位序号');
ok(st.rows.every((r) => r[3] === '有效'), '台账全部 ACTIVE → 状态列显示「有效」');
ok(new RegExp(`^已送 ${st.rows.length} 批次数`).test(st.sum) && st.sum.includes('已送合计') && st.sum.includes('剩余'), '底部汇总:已送批次数/已送合计/剩余/已退回');
const sumSent = Number((st.sum.match(/已送合计 ([\d.]+)/) || [])[1]);
const apiSent = (apiBatches.lines || []).reduce((a, l) => a + Number(l.已送数量 || 0), 0);
ok(Math.abs(sumSent - apiSent) < 0.01, `汇总已送合计 = 接口已送合计(${sumSent}/${apiSent})`);

// ── ③ 点「查看」跳暂收单 ──
const targetNo = (apiBatches.batches || [])[0]?.targetFormNo;
console.log(`\n=== ③ 点行「查看」→ 跳 ${targetNo} (QC_RECV) ===`);
await ev(`document.querySelector('.batch-tab .el-table__body-wrapper tbody tr .el-button')?.click(), 'ok'`);
await sleep(3500);
const jumped = await ev(`({ url: location.hash, chip: (document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 80) })`);
console.log('   hash:', jumped.url, '\n   头部:', jumped.chip);
ok(String(jumped.url).includes('QC_RECV'), '跳转到 QC_RECV 面板');
ok(String(jumped.chip).includes(targetNo), `卡片头部显示目标单据 ${targetNo}(而非列表首单)`);
// ③b 直接 URL 打开同一单,区分「路由跳转」与「参数定位」问题
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_RECV?docNo=${encodeURIComponent(targetNo)}` });
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right')`)) break; }
await sleep(2600);
const direct = await ev(`(document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 80)`);
console.log('   直连 URL 头部:', direct);
ok(String(direct).includes(targetNo), `直连 URL ?docNo= 定位正确(${targetNo})`);

// ── ② 已审核但无批次 ──
if (noBatch) {
  console.log(`\n=== ② 已审核但无批次:${noBatch} ===`);
  const s2 = await openPanel(noBatch);
  ok(s2.hasBatchTab, '页签仍出现(已审核)');
  await clickBatchTab();
  const s2b = await ev(READ);
  console.log('   空表文案:', JSON.stringify(s2b.empty), ' 汇总:', JSON.stringify(s2b.sum));
  ok(s2b.rows.length === 0 && s2b.empty.includes('该订单暂无送料批次'), '显示「该订单暂无送料批次」');
}

// ── ⑤ 状态无关性:审批通过即可见(含「已完成」),「已中止」不出现 ──
console.log('\n=== ⑤ 可见性口径:审批通过(含已完成)可见 / 已中止不可见 ===');
const apiList = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).list || [];
const sts = [...new Set(apiList.map((r) => String(r['单据状态'] || '')))];
console.log('   接口返回的采购订单状态:', JSON.stringify(sts));
const done = apiList.find((r) => String(r['单据状态']) === '已完成');
if (done) {
  const s5a = await openPanel(String(done['单据编号']));
  console.log(`   样本 ${done['单据编号']} 状态=已完成`);
  ok(s5a.hasBatchTab, `已完成订单仍保留送料批次页签: ${JSON.stringify(s5a.tabs)}`);
}
const stopped = apiList.find((r) => String(r['单据状态']) === '已中止');
if (stopped) {
  const s5 = await openPanel(String(stopped['单据编号']));
  console.log(`   样本 ${stopped['单据编号']} 状态=已中止`);
  ok(!s5.hasBatchTab, `已中止订单不出现送料批次页签: ${JSON.stringify(s5.tabs)}`);
} else {
  console.log('   [SKIP] 无「已中止」样本');
}
// ⑥ 其他面板不带该页签(页签只在采购订单出现)
console.log('\n=== ⑥ 页签仅采购订单拥有 ===');
const s6 = await openPanel2('QC_RECV', (apiBatches.batches || [])[0]?.targetFormNo);
ok(!s6.hasBatchTab, `送料暂收单不含送料批次页签: ${JSON.stringify(s6.tabs)}`);

await pool.close();
ws.close(); edge.kill();
console.log('\n性能快照(首屏可达耗时,含 Edge 冷启动 ~1s):');
firstPaint.forEach((l) => console.log('   ' + l));
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
