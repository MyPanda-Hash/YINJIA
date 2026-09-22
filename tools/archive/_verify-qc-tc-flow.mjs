/**
 * _verify-qc-tc-flow.mjs — 来料检验「特采」闸门全链验证(2026-09-22)
 *
 * 用户定稿口径:
 *   ① 来料检验单明细加「特采」开关(默认关);
 *   ② 勾特采的行:检验审核**不**生成 采购入库单/暂收退回单,改为每个特采行生成一张特采单
 *      (QC_TC_IN,一物料一单;总数量=合格+不合格,不合格品数量=不合格,比例自动算);
 *   ③ 特采单「审核」= 审批通过 → 自动生成**一张采购入库单**(数量=特采总数量,**全部入库、不走退料**);
 *   ④ 闸门(自动+手工都拦):特采单审批前,特采行不得进入库/退料(选单列表不可见、生单被拒);
 *   ⑤ 未勾特采的行行为不变。
 *
 * 断言(6 组):
 *   ① 检验行勾特采 → 检验审核:无入库/退料草稿,生成特采单(头字段/数量/批次键/链路 QC_INSP→QC_TC_IN),
 *      送料摘要该批次去向 = 特采单;
 *   ② 特采单未审核:batchFlow/lines(检验→入库/退料)不含特采行;batchFlow/generate 被拒(提示特采);
 *   ③ 特采单审核 → 自动生成一张采购入库单:实收数量=特采总数量、行 是否来料检验=是、
 *      不生成退料单、链路 QC_TC_IN→PURCHASE_IN、去向前进到入库单、检验行回填入库单号;
 *   ④ 入库单审核 → 批次号=入库日期(纯 yyyyMMdd),回填 暂收/检验/入库 + **特采单头** + links;
 *   ⑤ 级联:特采单弃审(入库已审)被挡 → 弃审入库 → 弃审特采单(入库草稿作废+释放)→ 重审特采单再生成;
 *      检验单弃审在特采单已审时被挡,特采单回草稿后弃审检验 → 特采单草稿作废;
 *   ⑥ 同一检验单未勾特采的另一行:照旧生成入库(合格)+退料(不良)。
 *
 * 用法: node tools/archive/_verify-qc-tc-flow.mjs   (env: YJ_API)
 */
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (msg) => console.log(`         ${msg}`);

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const N = (v) => (v === null || v === undefined ? null : String(v).trim());
const isBlank = (v) => N(v) === null || N(v) === '';
import { fetchRetry } from './_apifetch.mjs';
const lj = await (await fetchRetry(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj)); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const raw = async (url, body) => (await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()).replace(/-/g, '');
const TODAY = dstr();

// ============ 选样:一张已审核、余量够(≥20)的采购订单 + 补仓库 ============
console.log('=== 选样 ===');
const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.w)
  || N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
if (!WH) { console.error('bs_wh 无可用仓库'); await pool.close(); process.exit(1); }
console.log(`  补仓库用:${WH}   今天=${TODAY}`);
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
let PO = null;
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 20);
  if (!line) continue;
  PO = { no, line };
  break;
}
if (!PO) { console.error('找不到余量 ≥20 的已审核采购订单'); await pool.close(); process.exit(1); }
console.log(`  采购订单 ${PO.no}(行 ${PO.line.行号} 剩余 ${PO.line.剩余数量})`);

/** 分批送料 → 暂收审核 → 生成检验单(返回各单号/批次键) */
async function buildToInsp(qty, tag) {
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no, lines: [{ lineKey: PO.line.lineKey, qty }],
  });
  const recv = N(gen['编号']);
  const key = Number((await one(`SELECT TOP 1 id FROM yj_doc_batch WHERE target_form_no=N'${recv}' AND source_panel_code='PU_ORDER'`))?.id || 0);
  await cb('QC_RECV', '审核', { 编号: recv }); await sleep(600);
  const insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号']);
  return { tag, recv, insp, key };
}
/** 检验行造数:合格/不合格 + 是否勾特采(不良数量是计算列,不可写,由不合格数量推导) */
async function setInspRow(insp, okQty, badQty, special) {
  await q(`UPDATE qc_insp_detail SET 合格数量 = ${okQty}, 不合格数量 = ${badQty}, 特采 = ${special ? 1 : 0} WHERE 单据编号 = N'${insp}'`);
}

// ============ ① 特采行:检验审核 → 生成特采单,不生成入库/退料 ============
console.log('\n=== ① 特采行:检验审核 → 生成特采单(不生成入库/退料)===');
const A = await buildToInsp(20, 'A');
await setInspRow(A.insp, 12, 8, true);
info(`暂收单=${A.recv} 检验单=${A.insp} 批次键=${A.key}(合格 12 / 不合格 8,特采=1)`);
await cb('QC_INSP', '审核', { 编号: A.insp }); await sleep(900);
const a1 = await one(`SELECT
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${A.insp}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE') piLinks,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${A.insp}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE') thLinks,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${A.insp}' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE') tcLinks`);
info(`链路占用:${JSON.stringify(a1)}`);
ok(Number(a1.piLinks) === 0, `特采行**没有**自动生成采购入库单(占用 ${a1.piLinks} 条)`);
ok(Number(a1.thLinks) === 0, `特采行**没有**自动生成暂收退回单(占用 ${a1.thLinks} 条)`);
ok(Number(a1.tcLinks) === 1, `生成特采单占用 1 条 QC_INSP→QC_TC_IN`);
const tcRow = await one(`SELECT TOP 1 t.单据编号, t.总数量, t.不合格品数量, t.不合格品比例, t.产品名称, t.采购单号, t.检验单号, t.批次键, l.batch_id
  FROM qc_tc_in t JOIN form_flow_link l ON l.target_form_no = t.单据编号 AND l.target_panel_code='QC_TC_IN' AND l.source_panel_code='QC_INSP'
  WHERE l.source_form_no = N'${A.insp}' AND l.link_status='ACTIVE' ORDER BY t.id DESC`);
info(`特采单=${JSON.stringify(tcRow)}`);
ok(!!tcRow && N(tcRow.单据编号).startsWith('TCI-'), `特采单已生成且编号前缀 TCI(${tcRow?.单据编号})`);
ok(Number(tcRow?.总数量) === 20 && Number(tcRow?.不合格品数量) === 8,
  `总数量=合格+不合格=20、不合格品数量=8(实得 ${tcRow?.总数量}/${tcRow?.不合格品数量})`);
ok(N(tcRow?.不合格品比例) === '40%', `不合格品比例自动算=40%(实得 ${tcRow?.不合格品比例})`);ok(N(tcRow?.检验单号) === A.insp, `特采单带 检验单号=${A.insp}(实得 ${tcRow?.检验单号})`);
ok(Number(tcRow?.批次键) === A.key && Number(tcRow?.batch_id) === A.key, `特采单带 批次键=${A.key}(头 ${tcRow?.批次键} / 链 ${tcRow?.batch_id})`);
// 送料摘要:该批次去向 = 特采单(链路终点)
const bs1 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no });
const b1 = (bs1?.batches || []).find((x) => Number(x.batchId) === A.key);
info(`送料摘要该批次:${JSON.stringify(b1)}`);
ok(b1 && N(b1.targetPanel) === 'QC_TC_IN' && N(b1.targetFormNo) === N(tcRow.单据编号),
  `去向 = 特采单(实得 ${b1?.targetPanel}/${b1?.targetFormNo})`);

// ============ ② 特采单未审核:手工/推式路径被拦 ============
console.log('\n=== ② 特采单未审核:选单/推式生单拦特采行 ===');
const linesPi = await post('/px/batchFlow/lines', { sourcePanel: 'QC_INSP', targetPanel: 'PURCHASE_IN', sourceNo: A.insp });
const linesTh = await post('/px/batchFlow/lines', { sourcePanel: 'QC_INSP', targetPanel: 'QC_RETURN', sourceNo: A.insp });
info(`检验→入库 可选行=${JSON.stringify((linesPi?.lines || []).map((l) => l.剩余数量))}  检验→退料 可选行=${JSON.stringify((linesTh?.lines || []).map((l) => l.剩余数量))}`);
ok((linesPi?.lines || []).length === 0, `检验→入库:特采行不出现在可选列表(余量已被特采占用)`);
ok((linesTh?.lines || []).length === 0, `检验→退料:特采行不出现在可选列表`);
let genErr = '';
try { await post('/px/batchFlow/generate', { sourcePanel: 'QC_INSP', targetPanel: 'PURCHASE_IN', sourceNo: A.insp, lines: [{ lineKey: `${A.insp}#1`, qty: 1 }] }); }
catch (e) { genErr = String(e.message); }
info(`强行生单(检验→入库):${genErr.slice(0, 120)}`);
ok(genErr.includes('特采'), `生单被拒且提示特采(${genErr.slice(0, 60)}…)`);
const piBefore = Number((await one(`SELECT COUNT(*) n FROM bd_purchase_in WHERE 单据编号 LIKE (SELECT N'%' + 单据编号 + N'%' FROM qc_tc_in WHERE 单据编号=N'${tcRow.单据编号}')`))?.n || 0);

// ============ ③ 特采单审核 → 自动生成一张采购入库单(全部数量) ============
console.log('\n=== ③ 特采单审核 → 自动生成采购入库单(全部入库、不走退料)===');
await cb('QC_TC_IN', '审核', { 编号: tcRow.单据编号 }); await sleep(900);
const pi3 = await one(`SELECT TOP 1 p.单据编号, p.供应商, p.采购订单号, p.批次键, p.外部单据号,
  (SELECT SUM(b.实收数量) FROM bl_purchase_in b WHERE b.单据编号 = p.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y') qty,
  (SELECT MAX(b.是否来料检验) FROM bl_purchase_in b WHERE b.单据编号 = p.单据编号) inspFlag
  FROM bd_purchase_in p JOIN form_flow_link l ON l.target_form_no = p.单据编号 AND l.target_panel_code='PURCHASE_IN'
  WHERE l.source_panel_code='QC_TC_IN' AND l.source_form_no=N'${tcRow.单据编号}' AND l.link_status='ACTIVE' ORDER BY p.id DESC`);
info(`入库单=${JSON.stringify(pi3)}`);
ok(!!pi3, `特采审核后自动生成采购入库单(${pi3?.单据编号})`);
ok(Number(pi3?.qty) === 20, `实收数量 = 特采总数量 20(合格 12+不合格 8 全部入库;实得 ${pi3?.qty})`);
ok(N(pi3?.inspFlag) === '是', `行 是否来料检验=是(实得 ${pi3?.inspFlag})`);
ok(Number(pi3?.批次键) === A.key, `入库单带 批次键=${A.key}(实得 ${pi3?.批次键})`);
const tcLink3 = Number((await one(`SELECT COUNT(*) n FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=N'${tcRow.单据编号}' AND target_panel_code='PURCHASE_IN' AND target_form_no=N'${pi3.单据编号}' AND link_status='ACTIVE'`))?.n || 0);
ok(tcLink3 === 1, `链路 QC_TC_IN→PURCHASE_IN 已写(注:入库单无「外部单据号」列,2026-09-21 口径下线;追溯走链路+检验行入库单号)`);
const th3 = Number((await one(`SELECT COUNT(*) n FROM qc_return r JOIN form_flow_link l ON l.target_form_no=r.单据编号 AND l.target_panel_code='QC_RETURN' WHERE l.source_panel_code='QC_TC_IN' AND l.source_form_no=N'${tcRow.单据编号}'`))?.n || 0);
ok(th3 === 0, `特采**不**生成暂收退回单(${th3} 张)`);
const inBack = await one(`SELECT TOP 1 入库单号 FROM qc_insp_detail WHERE 单据编号=N'${A.insp}' ORDER BY id DESC`);
ok(N(inBack?.入库单号) === N(pi3?.单据编号), `检验行回填入库单号(实得 ${inBack?.入库单号})`);
const bs3 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no });
const b3 = (bs3?.batches || []).find((x) => Number(x.batchId) === A.key);
ok(b3 && N(b3.targetPanel) === 'PURCHASE_IN' && N(b3.targetFormNo) === N(pi3.单据编号),
  `去向前进到采购入库单(实得 ${b3?.targetPanel}/${b3?.targetFormNo})`);

// ============ ④ 入库单审核 → 批次号回填(含特采单头) ============
console.log('\n=== ④ 入库单审核 → 批次号=入库日期,回填全链(含特采单头)===');
const piWh = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${pi3.单据编号}'`);
if (isBlank(piWh?.w)) { await q(`UPDATE bl_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${pi3.单据编号}'`); await q(`UPDATE bd_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${pi3.单据编号}'`); }
await cb('PURCHASE_IN', '审核', { 编号: pi3.单据编号 }); await sleep(900);
const s4 = await one(`SELECT
  (SELECT [批次号] FROM sl_recv WHERE 单据编号=N'${A.recv}') recvH,
  (SELECT [批次号] FROM qc_insp WHERE 单据编号=N'${A.insp}') inspH,
  (SELECT [批次号] FROM bd_purchase_in WHERE 单据编号=N'${pi3.单据编号}') piH,
  (SELECT [批次号] FROM qc_tc_in WHERE 单据编号=N'${tcRow.单据编号}') tcH,
  (SELECT COUNT(*) FROM form_flow_link WHERE batch_id=${A.key} AND ISNULL(batch_no,'')<>'' AND link_status='ACTIVE') linkFilled`);
info(`回填:暂收=${s4.recvH} 检验=${s4.inspH} 入库=${s4.piH} 特采单=${s4.tcH} 链路=${s4.linkFilled} 行`);
ok(N(s4.piH) === TODAY, `入库单批次号 = 入库日期 ${TODAY}(实得 ${s4.piH})`);
ok([s4.recvH, s4.inspH, s4.piH, s4.tcH].every((v) => N(v) === TODAY),
  `批次号回填全链一致(暂收 ${s4.recvH} / 检验 ${s4.inspH} / 入库 ${s4.piH} / **特采单 ${s4.tcH}**)`);
ok(Number(s4.linkFilled) >= 3, `form_flow_link 该批次 ${s4.linkFilled} 行 batch_no 全回填`);

// ============ ⑤ 级联:特采单弃审(先挡后放)、重审再生成、检验弃审再挡再放 ============
console.log('\n=== ⑤ 弃审级联 ===');
let e5 = '';
try { await cb('QC_TC_IN', '弃审', { 编号: tcRow.单据编号 }); } catch (err) { e5 = String(err.message); }
ok(e5.includes('先弃审'), `入库单已审时弃审特采单被挡(${e5.slice(0, 70)}…)`);
await cb('PURCHASE_IN', '弃审', { 编号: pi3.单据编号 }); await sleep(700);
await cb('QC_TC_IN', '弃审', { 编号: tcRow.单据编号 }); await sleep(700);
const s5 = await one(`SELECT
  (SELECT ISNULL(canceled,'N') FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no=N'${pi3.单据编号}') piVoid,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=N'${tcRow.单据编号}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE') piLink`);
info(`特采弃审后:入库单 canceled=${s5.piVoid},QC_TC_IN→PURCHASE_IN ACTIVE=${s5.piLink}`);
ok(N(s5.piVoid) === 'Y', `特采弃审 → 生成的入库草稿作废`);
ok(Number(s5.piLink) === 0, `占用释放(QC_TC_IN→PURCHASE_IN 已无 ACTIVE)`);
await cb('QC_TC_IN', '审核', { 编号: tcRow.单据编号 }); await sleep(900);
const pi5 = await one(`SELECT TOP 1 p.单据编号 FROM bd_purchase_in p JOIN form_flow_link l ON l.target_form_no = p.单据编号 AND l.target_panel_code='PURCHASE_IN' WHERE l.source_panel_code='QC_TC_IN' AND l.source_form_no=N'${tcRow.单据编号}' AND l.link_status='ACTIVE' ORDER BY p.id DESC`);
ok(!!pi5 && N(pi5.单据编号) !== N(pi3.单据编号), `特采重审 → 重新生成入库单 ${pi5?.单据编号}(旧 ${pi3.单据编号} 已作废)`);
let e5b = '';
try { await cb('QC_INSP', '弃审', { 编号: A.insp }); } catch (err) { e5b = String(err.message); }
ok(e5b.includes('先弃审'), `特采单已审时弃审检验单被挡(${e5b.slice(0, 70)}…)`);
// 重生成的入库单(PI-0103)是**草稿**:特采弃审的级联会直接作废它,无需也不可先"弃审"
await cb('QC_TC_IN', '弃审', { 编号: tcRow.单据编号 }); await sleep(700);
await cb('QC_INSP', '弃审', { 编号: A.insp }); await sleep(900);
const s5c = await one(`SELECT (SELECT ISNULL(canceled,'N') FROM yj_doc_status WHERE panel_code='QC_TC_IN' AND doc_no=N'${tcRow.单据编号}') tcVoid`);
ok(N(s5c.tcVoid) === 'Y', `检验弃审(特采单回草稿后)→ 特采单草稿作废(canceled=${s5c.tcVoid})`);

// ============ ⑥ 未勾特采的行:行为不变(合格→入库、不良→退料) ============
console.log('\n=== ⑥ 未勾特采:照旧 合格→入库 / 不良→退料 ===');
const B = await buildToInsp(10, 'B');
await setInspRow(B.insp, 7, 3, false);
await cb('QC_INSP', '审核', { 编号: B.insp }); await sleep(900);
const s6 = await one(`SELECT
  (SELECT TOP 1 l.target_form_no FROM form_flow_link l WHERE l.source_panel_code='QC_INSP' AND l.source_form_no=N'${B.insp}' AND l.target_panel_code='PURCHASE_IN' AND l.link_status='ACTIVE') piNo,
  (SELECT TOP 1 l.target_form_no FROM form_flow_link l WHERE l.source_panel_code='QC_INSP' AND l.source_form_no=N'${B.insp}' AND l.target_panel_code='QC_RETURN' AND l.link_status='ACTIVE') thNo,
  (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code='QC_INSP' AND l.source_form_no=N'${B.insp}' AND l.target_panel_code='QC_TC_IN' AND l.link_status='ACTIVE') tcCnt`);
info(`未特采:${JSON.stringify(s6)}`);
ok(!!s6.piNo, `合格部分照旧自动生成采购入库单(${s6.piNo})`);
ok(!!s6.thNo, `不良部分照旧自动生成暂收退回单(${s6.thNo})`);
ok(Number(s6.tcCnt) === 0, `不生成特采单(${s6.tcCnt})`);
const piQty6 = Number((await one(`SELECT ISNULL(SUM(实收数量),0) q FROM bl_purchase_in WHERE 单据编号=N'${s6.piNo}'`))?.q || 0);
const thQty6 = Number((await one(`SELECT ISNULL(SUM(退货数量),0) q FROM qc_return_detail WHERE 单据编号=N'${s6.thNo}'`))?.q || 0);
ok(piQty6 === 7 && thQty6 === 3, `数量照旧拆分:入库 7 / 退料 3(实得 ${piQty6}/${thQty6})`);

// ============ 清理(反序 弃审→删除;批次号不回收) ============
console.log('\n=== 清理测试单据(反序 弃审 → 删除;批次号按口径不回收)===');
const docs = [
  ['PURCHASE_IN', pi5?.单据编号], ['QC_TC_IN', tcRow?.单据编号], ['QC_INSP', B.insp],
  ['PURCHASE_IN', s6.piNo], ['QC_RETURN', s6.thNo], ['QC_INSP', A.insp],
  ['QC_INSP', B.insp], ['QC_RECV', B.recv], ['QC_RECV', A.recv],
];
for (const [p, no] of docs) {
  if (!no) continue;
  for (const b of ['弃审', '删除']) {
    try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
    catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 80)}`); }
  }
}
console.log('\n=== 测试单据与台账留证 ===');
console.log(`  A: 暂收 ${A.recv} / 检验 ${A.insp} / 特采 ${tcRow?.单据编号} / 入库 ${pi3.单据编号}(作废)+${pi5?.单据编号}(重生成) / 批次键 ${A.key}`);
console.log(`  B: 暂收 ${B.recv} / 检验 ${B.insp} / 入库 ${s6.piNo} / 退料 ${s6.thNo} / 批次键 ${B.key}`);

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
