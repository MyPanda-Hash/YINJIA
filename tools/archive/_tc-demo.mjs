/**
 * _tc-demo.mjs — 特采链路真实数据演示(2026-09-22):一条数据走完
 *   分批送料 → 暂收审核 → 检验(勾特采:合格 6 / 不合格 4)→ 检验审核 → 特采单
 *   → 特采单审核(审批通过)→ 采购入库单(全部 10 入库)→ 入库审核(批次号回填 + kucun 记账)
 * 数据**保留不清理**,供用户在界面逐单点开核对;清理方式见脚本尾注释。
 */
import { createRequire } from 'node:module';
import { fetchRetry } from './_apifetch.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const N = (v) => (v === null || v === undefined ? null : String(v).trim());

const lj = await (await fetchRetry(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(JSON.stringify(j).slice(0, 260));
  return j.data;
};
const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} });

// ── 0) 选样:已审核 + 行剩余 ≥10 的采购订单;仓库取 恒亿仓 ──
const WH = N((await one(`SELECT TOP 1 仓库名称 FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.仓库名称)
  || N((await one(`SELECT TOP 1 仓库名称 FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.仓库名称);
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
let PO = null;
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 10);
  if (!line) continue;
  PO = { no, line };
  break;
}
if (!PO) { console.error('没有余量足够的已审核采购订单'); process.exit(1); }
console.log(`采购订单 ${PO.no}:行 ${PO.line.行号} ${PO.line.物料名称} ${PO.line.规格型号 || ''},剩余 ${PO.line.剩余数量},本次送料 10,仓库 ${WH}`);

// ── 1) 分批送料 → 暂收单,审核,生成检验单 ──
const gen = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no, lines: [{ lineKey: PO.line.lineKey, qty: 10 }] });
const recv = N(gen['编号']);
const key = Number((await one(`SELECT TOP 1 id FROM yj_doc_batch WHERE target_form_no=N'${recv}' AND source_panel_code='PU_ORDER'`))?.id || 0);
await cb('QC_RECV', '审核', { 编号: recv }); await sleep(600);
const insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号']);
console.log(`① 送料暂收单 ${recv}(批次键 ${key})→ 审核并生成来料检验单 ${insp}`);

// ── 2) 检验行:合格 6 / 不合格 4,勾特采 ──
await q(`UPDATE qc_insp_detail SET 合格数量 = 6, 不合格数量 = 4, 特采 = 1, 仓库代码 = N'${WH}' WHERE 单据编号 = N'${insp}'`);
const row = await one(`SELECT TOP 1 物料编码, 物料名称 FROM qc_insp_detail WHERE 单据编号=N'${insp}' ORDER BY id`);
console.log(`② 检验行 ${row.物料编码} ${row.物料名称}:合格 6 / 不合格 4,「特采」开,仓库=${WH}`);
await cb('QC_INSP', '审核', { 编号: insp }); await sleep(900);

// ── 3) 特采单 ──
const tc = await one(`SELECT TOP 1 t.单据编号, t.产品名称, t.总数量, t.不合格品数量, t.不合格品比例, t.采购单号, t.检验单号, t.备注
  FROM qc_tc_in t WHERE t.检验单号 = N'${insp}' ORDER BY t.id DESC`);
console.log(`③ 检验审核 → 特采单 ${tc.单据编号}:${tc.产品名称},总数量 ${Number(tc.总数量)}(=6+4),不合格品 ${Number(tc.不合格品数量)}(${tc.不合格品比例}),采购单号 ${N(tc.采购单号)}`);
console.log(`   备注:${N(tc.备注)}`);
// 此时应无 入库/退料 草稿
const none = await one(`SELECT
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${insp}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE') pi,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${insp}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE') th`);
console.log(`   (直接生成的入库单 ${none.pi} 张 / 退料单 ${none.th} 张 —— 都应为 0,走特采闸门)`);

// ── 4) 特采单审核 → 采购入库单 ──
await cb('QC_TC_IN', '审核', { 编号: tc.单据编号 }); await sleep(900);
const pi = await one(`SELECT TOP 1 p.单据编号,
  (SELECT SUM(b.实收数量) FROM bl_purchase_in b WHERE b.单据编号=p.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y') qty,
  (SELECT MAX(b.是否来料检验) FROM bl_purchase_in b WHERE b.单据编号=p.单据编号) flag,
  (SELECT MAX(b.仓库) FROM bl_purchase_in b WHERE b.单据编号=p.单据编号) wh
  FROM bd_purchase_in p JOIN form_flow_link l ON l.target_form_no=p.单据编号 AND l.target_panel_code='PURCHASE_IN'
  WHERE l.source_panel_code='QC_TC_IN' AND l.source_form_no=N'${tc.单据编号}' AND l.link_status='ACTIVE' ORDER BY p.id DESC`);
console.log(`④ 特采单审核(审批通过)→ 采购入库单 ${pi.单据编号}:实收 ${Number(pi.qty)}(全部入库),是否来料检验=${N(pi.flag)},仓库=${N(pi.wh)}`);

// ── 5) 入库单审核 → 批次号 + 库存记账 ──
await cb('PURCHASE_IN', '审核', { 编号: pi.单据编号 }); await sleep(1000);
const back = await one(`SELECT
  (SELECT [批次号] FROM sl_recv WHERE 单据编号=N'${recv}') recvH,
  (SELECT [批次号] FROM qc_insp WHERE 单据编号=N'${insp}') inspH,
  (SELECT [批次号] FROM bd_purchase_in WHERE 单据编号=N'${pi.单据编号}') piH,
  (SELECT [批次号] FROM qc_tc_in WHERE 单据编号=N'${tc.单据编号}') tcH`);
console.log(`⑤ 入库单审核 → 批次号 ${N(back.piH)} 回填:暂收=${N(back.recvH)} 检验=${N(back.inspH)} 入库=${N(back.piH)} 特采单=${N(back.tcH)}`);
const kc = await q(`SELECT TOP 3 wzdm, ckdm, CASE WHEN lot_no IS NULL THEN N'(NULL)' ELSE lot_no END AS lot_no, rkl, yl FROM kucun WHERE wzdm = N'${row.物料编码}' AND lot_no = N'${back.piH}' ORDER BY id DESC`);
console.log(`   库存台账 kucun:${JSON.stringify(kc)}`);
const bs = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no });
const b = (bs?.batches || []).find((x) => Number(x.batchId) === key);
console.log(`   采购订单「送料」浮层该批次:批次号=${N(b?.batchNo)} 去向=${N(b?.targetPanel)}/${N(b?.targetFormNo)}`);

console.log('\n===== 单据清单(保留在库,可在界面点开)=====');
console.log(`  送料暂收单 ${recv} / 来料检验单 ${insp} / 特采单 ${tc.单据编号} / 采购入库单 ${pi.单据编号}(已审核,已记台账)/ 批次键 ${key}`);
console.log('  清理方式:入库单弃审→特采单弃审→检验单弃审→(暂收单弃审)→逐单删除(批次号按口径不回收,台账行留证)');
await pool.close();
