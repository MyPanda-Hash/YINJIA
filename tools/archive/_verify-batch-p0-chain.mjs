/**
 * _verify-batch-p0-chain.mjs — 分批送料 P0:批次号全链路贯通验证
 *   采购订单 →(分批生单)→ 送料暂收 →(审核自动/生单)→ 来料检验 →(审核自动分流)→ 采购入库 + 暂收退回
 *   断言四张单批次号一致 + 按批次反查 + 台账只一条 + 链路 link 全带 batch_no;
 *   收尾清理测试单据(反序 弃审→删除),不留垃圾。
 * 用法: node tools/archive/_verify-batch-p0-chain.mjs [采购订单号]
 */
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const PO = process.argv[2] || 'YJ-20260916-03';

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败'); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => {
  const r = await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const callButton = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData, buttonParam: {} });
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const created = { SL_RECV: null, QC_INSP: null, PURCHASE_IN: null, QC_RETURN: null };

console.log(`\n=== ① 分批生单(${PO}) ===`);
const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO });
const line1 = st.lines.find((l) => Number(l.剩余数量) > 0);
if (!line1) { console.log('  [SKIP] 该订单无剩余可送'); await pool.close(); process.exit(0); }
const qty = Math.min(100, Number(line1.剩余数量));
const gen = await post('/px/batchFlow/generate', {
  sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO,
  lines: [{ lineKey: line1.lineKey, qty }],
});
created.SL_RECV = gen['编号'];
const batchNo = gen['批次号'];
console.log(`  送料 ${qty} → 暂收单 ${gen['编号']} 批次号 ${batchNo}`);
ok(!!batchNo, `取到批次号 ${batchNo}`);

console.log('\n=== ② 暂收单审核 → 生成来料检验单 ===');
await callButton('SL_RECV', '审核', { 编号: created.SL_RECV });
const insp = await callButton('SL_RECV', '生成来料检验单', { 编号: created.SL_RECV });
created.QC_INSP = insp['编号'];
console.log(`  检验单 = ${created.QC_INSP}`);
const inspHead = (await q(`SELECT 单据编号, 批次号, 采购订单号 FROM qc_insp WHERE 单据编号=N'${created.QC_INSP}'`))[0];
const inspLines = await q(`SELECT id, 物料编码, 数量, 送检数量, 合格数量, 不良数量, 采购订单行号, 批次号 FROM qc_insp_detail WHERE 单据编号=N'${created.QC_INSP}'`);
console.log('  检验单头:', JSON.stringify(inspHead), ' 行:', JSON.stringify(inspLines));
ok(String(inspHead?.批次号) === batchNo, `检验单头批次号 = ${batchNo}`);
ok(inspLines.every((l) => l.批次号 === batchNo), '检验单行批次号一致');
ok(String(inspHead?.采购订单号) === PO, '检验单头带采购订单号');
ok(inspLines.some((l) => Number(l.送检数量) > 0), '送检数量已带(暂收行数量下传)');

console.log('\n=== ③ 填检验结果(合格80/不良20)后审核 → 自动分流入库/退回 ===');
await q(`UPDATE qc_insp_detail SET 合格数量=80, 不合格数量=20, 数量=${qty} WHERE 单据编号=N'${created.QC_INSP}'`);
await callButton('QC_INSP', '审核', { 编号: created.QC_INSP });
// 取"本轮新生成、且未作废"的下游单(表内 单据状态 列对作废单不更新,作废真源在 yj_doc_status)
const pi = (await q(`SELECT 单据编号, 批次号 FROM bd_purchase_in WHERE 批次号=N'${batchNo}'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PURCHASE_IN' AND s.doc_no=bd_purchase_in.单据编号 AND ISNULL(s.canceled,'N')='Y')`))[0];
const th = (await q(`SELECT 单据编号, 批次号 FROM qc_return WHERE 批次号=N'${batchNo}'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_RETURN' AND s.doc_no=qc_return.单据编号 AND ISNULL(s.canceled,'N')='Y')`))[0];
created.PURCHASE_IN = pi?.单据编号 || null;
created.QC_RETURN = th?.单据编号 || null;
console.log(`  采购入库单 = ${created.PURCHASE_IN} 批次号 ${pi?.批次号};暂收退回单 = ${created.QC_RETURN} 批次号 ${th?.批次号}`);
ok(!!created.PURCHASE_IN && pi?.批次号 === batchNo, `采购入库单继承批次号(${created.PURCHASE_IN})`);
ok(!!created.QC_RETURN && th?.批次号 === batchNo, `暂收退回单继承批次号(${created.QC_RETURN})`);
// 注意:PURCHASE_IN 行的「采购订单行号」落在列 源单行号(标签与列名不同,见 migrate-po-chain-link)
const piLines = await q(`SELECT 源单行号 AS 采购订单行号, 批号, 批次号 FROM bl_purchase_in WHERE 单据编号=N'${created.PURCHASE_IN}'`);
const thLines = await q(`SELECT 采购订单行号, 退货数量, 批次号 FROM qc_return_detail WHERE 单据编号=N'${created.QC_RETURN}'`);
console.log('  入库行:', JSON.stringify(piLines), ' 退回行:', JSON.stringify(thLines));
ok(piLines.every((l) => l.批次号 === batchNo), '入库行批次号一致');
ok(thLines.every((l) => l.批次号 === batchNo), '退回行批次号一致');

console.log('\n=== ④ 按批次反查 + link 批次号 ===');
const byBatch = await (await fetch(`${API}/px/batchFlow/batch?batchNo=${encodeURIComponent(batchNo)}`, { headers: H })).json();
console.log('  反查:', JSON.stringify(byBatch.data));
const links = byBatch?.data?.links || [];
const hops = links.map((l) => `${l.sourcePanel}→${l.targetPanel}`).sort();
ok(hops.includes('PU_ORDER→SL_RECV') && hops.includes('SL_RECV→QC_INSP') && hops.includes('QC_INSP→PURCHASE_IN') && hops.includes('QC_INSP→QC_RETURN'),
  `四跳 link 均带该批次号:${JSON.stringify(hops)}`);
const linkRows = await q(`SELECT source_panel_code, target_panel_code, link_status, linked_quantity, batch_no FROM form_flow_link WHERE batch_no=N'${batchNo}'`);
console.log('  link 明细:', JSON.stringify(linkRows));
ok(linkRows.length >= 4 && linkRows.every((r) => r.batch_no === batchNo), `link 全部带批次号(${linkRows.length} 行)`);
const consumed = (await q(`SELECT SUM(CAST(linked_quantity AS decimal(18,4))) s FROM form_flow_link WHERE batch_no=N'${batchNo}' AND source_panel_code='PU_ORDER' AND link_status='ACTIVE'`))[0].s;
ok(Math.abs(Number(consumed) - qty) < 0.001, `订单侧占用 = 本次送料量 ${qty}(实得 ${consumed})`);

console.log('\n=== ⑤ 清理测试单据(反序) ===');
for (const [panel, no] of [['PURCHASE_IN', created.PURCHASE_IN], ['QC_RETURN', created.QC_RETURN], ['QC_INSP', created.QC_INSP], ['SL_RECV', created.SL_RECV]]) {
  if (!no) continue;
  for (const btn of ['弃审', '删除']) {
    try { await callButton(panel, btn, { 编号: no }); console.log(`  ${panel} ${no} ${btn} ✓`); }
    catch (e) { console.log(`  ${panel} ${no} ${btn} 跳过:${String(e.message).slice(0, 90)}`); }
  }
}
// 清理校验:单据作废真源在 yj_doc_status(表内 asp_cancel 不随作废更新);台账/占用必须无 ACTIVE 残留
const left = (await q(`SELECT
  (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='SL_RECV' AND s.doc_no=N'${created.SL_RECV}' AND ISNULL(s.canceled,'N')='Y') 暂收已作废,
  (SELECT COUNT(*) FROM yj_doc_batch WHERE batch_no=N'${batchNo}' AND status='ACTIVE') 台账有效,
  (SELECT COUNT(*) FROM form_flow_link WHERE batch_no=N'${batchNo}' AND link_status='ACTIVE') 占用未释放,
  (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=N'${created.QC_INSP}' AND ISNULL(s.canceled,'N')='Y') 检验已作废`))[0];
console.log('  清理后:', JSON.stringify(left));
ok(Number(left.暂收已作废) === 1 && Number(left.检验已作废) === 1 && Number(left.台账有效) === 0 && Number(left.占用未释放) === 0,
  '测试单据已作废、台账序号已回收、占用已全部释放');

await pool.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
