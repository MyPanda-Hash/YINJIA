/**
 * _verify-purchase-in-tc-flag.mjs — 采购入库单明细「特采」标记验证(2026-09-23)
 *
 * 背景(用户口径):「采购入库单的明细表缺少一个特采字段,来判定来料检验单过来的数据是否是特采的」
 *   「这个字段和来料检验的字段一样,是从来料检验来的」
 *
 * 验证:
 *   ① 存储:bl_purchase_in.[特采] 已建 + 中文注明(MS_Description)
 *   ② 元数据:yj_field PURCHASE_IN 明细「特采」= 下拉框 是/否 + 只读(editable=0)+ 面板配置 API 可见
 *      多语言:en 下该列显示名 = Special acceptance(列头不再出现中文)
 *   ③ 存量:全库无空值;链路台账里有 QC_TC_IN→PURCHASE_IN 的单**全部**标「是」
 *   ④ 全链实测(特采):采购订单 → 暂收单 → 检验单(勾「特采」)→ 审核检验单 → 自动生成特采单
 *      → 审核特采单 → 自动生成采购入库单 → **入库行 特采=是**(且 是否来料检验=是)
 *   ⑤ 对照实测(普通):同链不勾特采 → 审核检验单 → 自动生成采购入库单 → 入库行 特采=否
 *   ⑥ 界面:采购入库单明细列出现「特采」且值 = 是
 *
 * 用法: node tools/archive/_verify-purchase-in-tc-flag.mjs [--ui-only]
 *   --ui-only: 只跑 ⑥ 界面走查(拿库里最新一张「特采=是」的入库单,不再生成新单据)
 * 注:④⑤ 会在本地库真实生成单据(各耗 1 个订单剩余量),与 _verify-chain-insp-fields.mjs 同口径;
 *     本地库测试数据在打部署备份前统一清理(见 migrate-golive-cleanup.sql 模式)。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const UI_ONLY = process.argv.includes('--ui-only');
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9465;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => (await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());
const get = async (url, headers) => (await (await fetch(API + url, { headers: headers || H })).json());

/* ---------- ① 存储:列 + 中文注明 ---------- */
if (!UI_ONLY) {
console.log('=== ① 存储:bl_purchase_in.[特采] + 中文注明 ===');
const col = await q(`SELECT c.name, t.name AS typ, c.max_length, c.is_nullable,
       (SELECT CAST(ep.value AS nvarchar(400)) FROM sys.extended_properties ep
         WHERE ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description') AS descr
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND c.name=N'特采'`);
ok(col.length === 1, `列已建(${col.length} 行)`);
console.log(`   类型 ${col[0]?.typ}(${col[0]?.max_length}) 可空=${col[0]?.is_nullable}`);
console.log(`   注明: ${col[0]?.descr || '(无)'}`);
ok(!!col[0]?.descr && /特采/.test(col[0].descr), '列有中文注明');

/* ---------- ② 元数据 + 面板配置 API + 多语言 ---------- */
console.log('\n=== ② 元数据 / 面板配置 / 多语言 ===');
const fld = await q(`SELECT col_name,label,data_type,dict_sql,place,seq,width,editable,required,hidden,visible
  FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'特采'`);
ok(fld.length === 1, 'yj_field 已登记');
const f = fld[0] || {};
console.log(`   ${JSON.stringify(f)}`);
ok(f.data_type === '下拉框', `data_type=下拉框(实测 ${f.data_type};写「下拉」前端会退化成文本框)`);
ok(f.place === 'detail' && !f.editable && !f.hidden && f.visible, '明细列 / 只读 / 可见');
ok(/是/.test(f.dict_sql || '') && /否/.test(f.dict_sql || ''), '字典含 是/否 两项');

const cfg = await get('/px/getPanelConfig?panelCode=PURCHASE_IN');
const det = (cfg?.data?.detail?.tabs || []).flatMap((t) => t.fields || []);
const cf = det.find((x) => x.dataName === '特采');
ok(!!cf, '面板配置明细字段含「特采」(界面据此渲染列)');
console.log(`   ${JSON.stringify(cf)}`);
ok(cf?.dataType === '下拉框' && cf?.readonly === true, '配置:下拉框 + 只读');
ok(JSON.stringify(cf?.options) === JSON.stringify(['是', '否']), `选项 = 是/否(实测 ${JSON.stringify(cf?.options)})`);
const cfgEn = await get('/px/getPanelConfig?panelCode=PURCHASE_IN', { ...H, 'Accept-Language': 'en-US' });
const detEn = (cfgEn?.data?.detail?.tabs || []).flatMap((t) => t.fields || []);
const cfEn = detEn.find((x) => x.dataName === '特采');
console.log(`   en 显示名: ${cfEn?.displayName || '(回退中文)'}`);
ok(cfEn?.displayName === 'Special acceptance', 'en 下显示 Special acceptance(不回落中文)');

/* ---------- ③ 存量:无空值 + 特采链路单据全为「是」 ---------- */
console.log('\n=== ③ 存量回填 ===');
const dist = await q(`SELECT ISNULL([特采],N'(空)') v, COUNT(*) c FROM bl_purchase_in GROUP BY [特采]`);
console.log('   分布:', JSON.stringify(dist));
ok(!dist.some((d) => d.v === '(空)'), '无空值');
const linkRows = await q(`SELECT DISTINCT l.target_form_no AS no,
    (SELECT TOP 1 p.[特采] FROM bl_purchase_in p WHERE p.[单据编号]=l.target_form_no) AS tc
  FROM form_flow_link l WHERE l.source_panel_code='QC_TC_IN' AND l.target_panel_code='PURCHASE_IN'`);
console.log(`   特采链路单据 ${linkRows.length} 张:`, JSON.stringify(linkRows.map((r) => `${r.no}=${r.tc}`)));
ok(linkRows.length > 0 && linkRows.every((r) => r.tc === '是'), '特采链路单据的入库行全为「是」');
}

/* ---------- 全链实测工具 ---------- */
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });

/** 找一张「已审核且还有可送量」的采购订单 */
async function pickPo() {
  const list = ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).data?.list || [])
    .filter((r) => String(r['单据状态']) === '已审核').map((r) => String(r['单据编号'])).slice(0, 40);
  for (const no of list) {
    const ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no });
    const l = (ls.data?.lines || []).find((x) => Number(x.剩余数量) > 0);
    if (l) return { po: no, line: l };
  }
  return null;
}

/** 采购订单 → 暂收单 → 来料检验单(草稿),返回检验单号 */
async function buildInspection(tag) {
  const picked = await pickPo();
  if (!picked) { console.log(`   [SKIP] ${tag}:没有可送量的采购订单`); return null; }
  const qty = Math.min(1, Number(picked.line.剩余数量));
  const recvNo = (await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: picked.po,
    lines: [{ lineKey: picked.line.lineKey, qty }],
  })).data?.编号;
  await cb('QC_RECV', '审核', { 编号: recvNo });
  await sleep(1000);
  const gen = await cb('QC_RECV', '生成来料检验单', { 编号: recvNo });
  const inspNo = gen.data?.编号 || gen.data?.data?.编号;
  console.log(`   ${tag}:采购订单 ${picked.po} → 暂收单 ${recvNo} → 检验单 ${inspNo}(本次 ${qty})`);
  return inspNo;
}

/* ---------- ④ 全链实测:特采 ---------- */
console.log('\n=== ④ 全链实测:检验勾「特采」→ 特采单 → 采购入库单 ===');
let tcPiNo = null;
if (!UI_ONLY) {
  const inspNo = await buildInspection('特采链');
  if (inspNo) {
    // 模拟品质填检验结果:合格数量=送检数量,并勾「特采」(与前端复选框落库同列 qc_insp_detail.特采)
    await q(`UPDATE qc_insp_detail SET [合格数量]=[送检数量], [特采]=1 WHERE [单据编号]=N'${inspNo}'`);
    const before = await q(`SELECT [物料编码],[送检数量],[合格数量],[特采] FROM qc_insp_detail WHERE [单据编号]=N'${inspNo}'`);
    console.log('   检验行(勾特采):', JSON.stringify(before));
    await cb('QC_INSP', '审核', { 编号: inspNo });
    await sleep(1500);
    const tcNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link
      WHERE source_panel_code='QC_INSP' AND source_form_no=N'${inspNo}' AND target_panel_code='QC_TC_IN'
        AND link_status='ACTIVE'`))[0]?.no;
    console.log(`   特采行 → 特采单 ${tcNo}`);
    ok(!!tcNo, '审核检验单 → 自动生成特采单(检验行 特采 已带下)');
    if (tcNo) {
      const tcHead = (await q(`SELECT [总数量],[不合格品数量],[检验单号] FROM qc_tc_in WHERE [单据编号]=N'${tcNo}'`))[0] || {};
      console.log('   特采单头:', JSON.stringify(tcHead));
      await cb('QC_TC_IN', '审核', { 编号: tcNo });
      await sleep(1800);
      tcPiNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link
        WHERE source_panel_code='QC_TC_IN' AND source_form_no=N'${tcNo}' AND target_panel_code='PURCHASE_IN'
          AND link_status='ACTIVE'`))[0]?.no;
      console.log(`   特采单审核 → 采购入库单 ${tcPiNo}`);
      const rows = tcPiNo ? await q(`SELECT [存货编码],[规格型号],[实收数量],[是否来料检验],[特采]
        FROM bl_purchase_in WHERE [单据编号]=N'${tcPiNo}'`) : [];
      console.log('   入库行:', JSON.stringify(rows));
      ok(rows.length > 0 && rows.every((r) => r['特采'] === '是'), `特采链入库行 特采=是(实测 ${JSON.stringify(rows.map((r) => r['特采']))})`);
      ok(rows.length > 0 && rows.every((r) => r['是否来料检验'] === '是'), '同链 是否来料检验=是(与既有口径一致)');
    }
  }
}

/* ---------- ⑤ 对照实测:普通链(不勾特采) ---------- */
console.log('\n=== ⑤ 对照实测:不勾特采 → 采购入库单 特采=否 ===');
if (!UI_ONLY) {
  const inspNo = await buildInspection('普通链');
  if (inspNo) {
    await q(`UPDATE qc_insp_detail SET [合格数量]=[送检数量] WHERE [单据编号]=N'${inspNo}'`);
    const chk = await q(`SELECT [特采] FROM qc_insp_detail WHERE [单据编号]=N'${inspNo}'`);
    ok(chk.every((r) => Number(r['特采']) === 0), '对照链检验行 特采=0');
    await cb('QC_INSP', '审核', { 编号: inspNo });
    await sleep(1500);
    const piNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link
      WHERE source_panel_code='QC_INSP' AND source_form_no=N'${inspNo}' AND target_panel_code='PURCHASE_IN'
        AND link_status='ACTIVE'`))[0]?.no;
    const rows = piNo ? await q(`SELECT [存货编码],[实收数量],[是否来料检验],[特采] FROM bl_purchase_in WHERE [单据编号]=N'${piNo}'`) : [];
    console.log(`   检验单审核 → 采购入库单 ${piNo}`);
    console.log('   入库行:', JSON.stringify(rows));
    ok(rows.length > 0 && rows.every((r) => r['特采'] === '否'), `普通链入库行 特采=否(实测 ${JSON.stringify(rows.map((r) => r['特采']))})`);
  }
}

/* ---------- ⑥ 界面:明细列「特采」 ---------- */
console.log('\n=== ⑥ 界面:采购入库单明细列「特采」 ===');
// --ui-only 模式:不生成新单据,直接拿库里最新一张「特采=是」的入库单走查
const uiDocNo = tcPiNo
  || (await q(`SELECT TOP 1 p.[单据编号] AS no FROM bl_purchase_in p
       JOIN bd_purchase_in h ON h.[单据编号]=p.[单据编号]
       WHERE p.[特采]=N'是' AND ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY p.id DESC`))[0]?.no;
if (!uiDocNo) {
  console.log('   [SKIP] 库里没有标「特采=是」的入库单,跳过界面走查');
} else {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pitc-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(1000);
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch { /* 等待 CDP 起来 */ }
  }
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
    localStorage.setItem('mes_login_date','2026-09-23'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PURCHASE_IN?docNo=${encodeURIComponent(uiDocNo)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.detail')`)) break; }
  await sleep(2600);
  const ui = await ev(`(() => {
    const heads = [...document.querySelectorAll('.detail thead th')].map((th) => th.textContent.replace(/[\\u21c5\\u25b2\\u25bc]/g,'').trim());
    const i = heads.indexOf('特采');
    const tb = document.querySelector('.detail .el-table__body-wrapper table');
    const rows = tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [];
    const filled = rows.filter((r) => r.some((c) => c !== ''));
    return { idx: i, values: i >= 0 ? filled.map((r) => r[i]) : [], heads: heads.filter((h) => h === '特采' || h === '是否来料检验') };
  })()`);
  console.log(`   入库单 ${uiDocNo} 相关列头:`, JSON.stringify(ui.heads));
  console.log('   特采 列值:', JSON.stringify(ui.values));
  ok(ui.idx >= 0, '明细列包含「特采」');
  ok(ui.values.length > 0 && ui.values.every((v) => v === '是'), `特采链单据界面显示「是」(${JSON.stringify([...new Set(ui.values)])})`);
  ws.close(); edge.kill();
}

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
