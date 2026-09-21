/**
 * _verify-chain-field-complete.mjs — 采购链修复 ③ 验证(用户四条口径)
 *   ① 单据日期统一:各处表头日期字段标签都是「单据日期」(不再有「日期」)
 *   ② 入库单来源用采购订单号:入库头 采购订单号 有值(转ERP 用它做 src_bill_no,不依赖死列)
 *   ③ 采购入库单完整:送检数量/部门名称/生产日期/行备注/是否来料检验/供应商编码/规格型号 全带过来
 *   ⑤ 送料暂收单字段补全:数量2/计量单位2/税率%/含税单价/含税金额/折扣%/预计到货日期/仓库 随采购订单带入
 * 全链实测:采购订单 → 暂收单 → 检验单 →(审核)→ 采购入库单 + 暂收退回单
 * 用法: node tools/archive/_verify-chain-field-complete.mjs
 */
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => (await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });

console.log('=== ① 单据日期统一 ===');
const dateRows = await q(`SELECT panel_code, col_name, label, place FROM yj_field WHERE label = N'日期' AND place LIKE '%header%'`);
ok(dateRows.length === 0, `无任何"表头位 label=日期"的字段(残留 ${dateRows.length} 行)`);
const recvHead = (await (await fetch(API + '/px/getPanelConfig?panelCode=QC_RECV', { headers: H })).json()).data?.dataSchema?.fields || [];
const recvDateLabels = recvHead.filter((f) => /日期/.test(f.dataName)).map((f) => f.dataName);
console.log('   暂收单表头日期字段:', JSON.stringify(recvDateLabels));
ok(recvDateLabels.includes('单据日期') && !recvDateLabels.includes('日期'), '送料暂收单表头日期字段 = 单据日期');

console.log('\n=== ③ 采购入库单字段(面板登记) ===');
const piCfg = (await (await fetch(API + '/px/getPanelConfig?panelCode=PURCHASE_IN', { headers: H })).json()).data;
const piDetail = (piCfg?.detail?.tabs || []).flatMap((t) => t.fields || []).map((f) => f.dataName);
console.log('   明细字段:', JSON.stringify(piDetail));
for (const f of ['送检数量', '部门名称', '生产日期', '备注', '是否来料检验', '仓库']) {
  ok(piDetail.includes(f), `采购入库单明细已含「${f}」`);
}

console.log('\n=== ⑤ 送料暂收单字段(面板登记) ===');
const rvCfg = (await (await fetch(API + '/px/getPanelConfig?panelCode=QC_RECV', { headers: H })).json()).data;
const rvDetail = (rvCfg?.detail?.tabs || []).flatMap((t) => t.fields || []).map((f) => f.dataName);
for (const f of ['数量2', '计量单位2', '税率%', '含税单价', '含税金额', '折扣%', '预计到货日期', '仓库']) {
  ok(rvDetail.includes(f), `送料暂收单明细已含「${f}」`);
}

console.log('\n=== 全链实测 ===');
// 挑一张已审核、还有可送量、且行上有金额/税/仓库的采购订单(便于验证字段真的带过来了)
let po = null, poLine = null;
for (const cand of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).data?.list || [])
  .filter((r) => String(r['单据状态']) === '已审核').map((r) => String(r['单据编号'])).slice(0, 30)) {
  const ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: cand });
  const l = (ls.data?.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (l) {
    const rich = (await q(`SELECT TOP 1 [税率%],[含税单价],[含税金额],[仓库],[数量2] FROM bl_pu_order WHERE [单据编号]=N'${cand}' AND ISNULL([含税单价],0)>0`))[0];
    if (rich) { po = cand; poLine = l; break; }
    if (!po) { po = cand; poLine = l; }
  }
}
if (!po) { console.log('   [SKIP] 无可用采购订单'); } else {
  const srcRow = (await q(`SELECT TOP 1 [税率%],[含税单价],[含税金额],[折扣%],[仓库],[数量2],[计量单位2] FROM bl_pu_order WHERE [单据编号]=N'${po}'`))[0];
  console.log(`   采购订单 ${po} 行(源):`, JSON.stringify(srcRow));
  const qty = Math.min(1, Number(poLine.剩余数量));
  const recvNo = (await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po, lines: [{ lineKey: poLine.lineKey, qty }] })).data?.编号;
  const recvRow = (await q(`SELECT [数量],[数量2],[计量单位2],[税率%],[含税单价],[含税金额],[折扣%],[预计到货日期],[仓库] FROM sl_recv_detail WHERE [单据编号]=N'${recvNo}'`))[0] || {};
  console.log(`   ① 暂收单 ${recvNo} 行:`, JSON.stringify(recvRow));
  ok(Number(recvRow['税率%'] || 0) === Number(srcRow['税率%'] || 0), `暂收行 税率% 已带入(${recvRow['税率%']} vs 源 ${srcRow['税率%']})`);
  ok(Number(recvRow['含税单价'] || 0) === Number(srcRow['含税单价'] || 0), `暂收行 含税单价 已带入(${recvRow['含税单价']})`);
  ok(Number(recvRow['含税金额'] || 0) === Number(srcRow['含税金额'] || 0), `暂收行 含税金额 已带入(${recvRow['含税金额']})`);
  ok(String(recvRow['仓库'] || '') === String(srcRow['仓库'] || ''), `暂收行 仓库 已带入(${recvRow['仓库']})`);
  const recvHeadDate = (await q(`SELECT CONVERT(varchar(10),[单据日期],120) d FROM sl_recv WHERE [单据编号]=N'${recvNo}'`))[0]?.d;
  ok(!!recvHeadDate, `暂收单头 单据日期 有值(${recvHeadDate})`);

  await cb('QC_RECV', '审核', { 编号: recvNo }); await sleep(1200);
  const inspNo = (await cb('QC_RECV', '生成来料检验单', { 编号: recvNo })).data?.编号;
  const inspHead = (await q(`SELECT [暂收单号],[单据日期],[供应商代码] FROM qc_insp WHERE [单据编号]=N'${inspNo}'`))[0] || {};
  console.log(`   ② 检验单 ${inspNo} 头:`, JSON.stringify(inspHead));
  ok(String(inspHead['暂收单号'] || '') === String(recvNo), '检验单 暂收单号 已带');
  ok(!!inspHead['单据日期'], `检验单 单据日期 有值(${inspHead['单据日期']})`);
  await q(`UPDATE qc_insp_detail SET [合格数量] = [送检数量], [不合格数量] = 0 WHERE [单据编号]=N'${inspNo}'`);
  await cb('QC_INSP', '审核', { 编号: inspNo }); await sleep(1500);
  const piNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${inspNo}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))[0]?.no;
  const piRow = (await q(`SELECT [存货编码],[规格型号],[实收数量],[送检数量],[部门名称],[生产日期],[是否来料检验],[仓库],[备注] FROM bl_purchase_in WHERE [单据编号]=N'${piNo}'`))[0] || {};
  const piHead = (await q(`SELECT [供应商编码],[采购订单号],[批次号] FROM bd_purchase_in WHERE [单据编号]=N'${piNo}'`))[0] || {};
  console.log(`   ③ 入库单 ${piNo} 头:`, JSON.stringify(piHead));
  console.log('      行:', JSON.stringify(piRow));
  ok(Number(piRow['送检数量'] || 0) === qty, `入库行 送检数量 已带(${piRow['送检数量']})`);
  ok(String(piRow['是否来料检验']) === '是', '入库行 是否来料检验 = 是');
  ok(!!piRow['规格型号'], '入库行 规格型号 已带');
  ok(String(piHead['采购订单号'] || '') === String(await q(`SELECT [采购订单号] x FROM qc_insp WHERE [单据编号]=N'${inspNo}'`).then((r) => r[0].x)), `入库头 采购订单号 已带(${piHead['采购订单号']}) ← 转ERP 用它做 src_bill_no`);
  ok(!!piHead['供应商编码'], `入库头 供应商编码 已带(${piHead['供应商编码']},修复前 0/13)`);

  // 退回单:弃审 → 置不良量 → 重新审核(walk inspAutoReturn 自动生单路径;
  // 注:「生成暂收退回单」按钮尚未实现规则,故走审核钩子)
  await cb('QC_INSP', '弃审', { 编号: inspNo }); await sleep(1200);
  await q(`UPDATE qc_insp_detail SET [合格数量] = 0, [不合格数量] = [送检数量] WHERE [单据编号]=N'${inspNo}'`);
  await cb('QC_INSP', '审核', { 编号: inspNo }); await sleep(1800);
  const retNo = (await q(`SELECT TOP 1 target_form_no no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${inspNo}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'`))[0]?.no;
  const retRow = retNo ? (await q(`SELECT [物料编码],[规格型号],[退货数量],[单位],[计量单位] FROM qc_return_detail WHERE [单据编号]=N'${retNo}'`))[0] : null;
  const retHead = retNo ? (await q(`SELECT [单据日期],[检验单号] FROM qc_return WHERE [单据编号]=N'${retNo}'`))[0] : null;
  console.log(`   ④ 退回单 ${retNo} 头:`, JSON.stringify(retHead), ' 行:', JSON.stringify(retRow));
  ok(!!retHead?.['单据日期'], `退回单 单据日期 有值(${retHead?.['单据日期']},修复前 9/9 空)`);
  ok(Number(retRow?.['退货数量'] || 0) === qty, `退回行 退货数量 已带(${retRow?.['退货数量']})`);
}

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
