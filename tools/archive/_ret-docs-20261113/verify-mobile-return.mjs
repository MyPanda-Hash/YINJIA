/**
 * 端到端:手机扫码退料 → 生成「生产退料单」(MATERIAL_RET) → 审核记账 → 转ERP 到金蝶沙箱
 *
 * 覆盖 2026-11-13 用户口径:
 *   ①「手机扫码的生产退料扫码后退料后填入的单据从其他入库改成生产退料单」
 *   ②「生产退料要有工单号和工单行号」
 *
 * 做法:先用真实后端接口把一张材料出库单做出来并审核(仓管审批),再把它挂到 wo_pick_doc 台账,
 * 然后调 /submitReturn 走真实的手机退料代码路径;最后校验落库单据类型/工单号/工单行号/记账/转ERP。
 *
 * 用法: node tools/archive/_ret-docs-20261113/verify-mobile-return.mjs [BASE]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js';

const BASE = process.argv[2] || process.env.YJ_API || 'http://127.0.0.1:8090';
const today = new Date().toISOString().slice(0, 10);

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
if (!login?.data?.token) { console.log('❌ 登录失败', JSON.stringify(login).slice(0, 200)); process.exit(1); }
const token = login.data.token;
console.log(`✅ 测试账套会话 @ ${BASE}`);

const post = async (path, body) => (await fetch(`${BASE}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})).json();
const call = (panelCode, buttonName, formData) => post('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} });
const okOf = (r) => r?.code === 0 || r?.code === 200;

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
const q = async (sql) => (await pool.request().query(sql)).recordset;

// ── ① 造一张「已完成」的领料单(材料出库单),供退料冲减
const woNo = 'GD-TEST-' + Date.now().toString().slice(-6);
const woLine = 1;
const MATERIAL = 'YJ-KBL-012';       // 测试库有的材料(1 个=1)
const UOM = '个';
const WH_CODE = 'CK00006', WH_NAME = '华北工控仓';

const saved = await call('MATERIAL_OUT', '保存', {
  单据日期: today, 业务类型: '生产领料', 备注: `手机退料 E2E ${woNo}`,
  detail: { items: [{ 材料编码: MATERIAL, 材料名称: 'PP棉', 数量: 10, 单价: 5, 计量单位: UOM, 仓库编码: WH_CODE, 仓库: WH_NAME }] },
});
const outNo = saved?.data?.编号 || saved?.data?.单据编号 || '';
console.log(`① 领料单保存: ${okOf(saved) ? '✅' : '❌'} ${outNo} ${okOf(saved) ? '' : JSON.stringify(saved).slice(0, 300)}`);
if (!outNo) process.exit(1);
const audited = await call('MATERIAL_OUT', '审核', { 单据编号: outNo, 编号: outNo });
console.log(`   领料单审核: ${okOf(audited) ? '✅' : '❌'} ${okOf(audited) ? '' : JSON.stringify(audited).slice(0, 300)}`);

// 库存基线要在**领料审核之后**取(领料已扣 10,退料应当只加回本次退的 3)
const before = await q(`SELECT ISNULL(yl,0) yl FROM kucun WHERE wzdm=N'${MATERIAL}' AND ckdm=N'${WH_CODE}' AND ISNULL(lot_no,'')=''`);
const stockBefore = before.length ? Number(before[0].yl) : 0;
console.log(`库存基线(领料审核后): ${MATERIAL} @ ${WH_CODE} = ${stockBefore}`);

// ── ② 挂到台账(wo_pick_doc):状态=已完成,领料单号=刚建的张
const ledger = (await q(`SELECT TOP 1 id FROM wo_pick_doc ORDER BY id DESC`))[0];
if (!ledger) { console.log('❌ 测试库没有 wo_pick_doc 行,无法模拟台账'); process.exit(1); }
const ledgerId = ledger.id;
await pool.request().query(
  `UPDATE wo_pick_doc SET 工单号=N'${woNo}', 工单行号=${woLine}, 产品编号=N'A-48-16', 产品名称=N'E2E 产品',
     领料单号=N'${outNo}', 状态=N'已完成', 物料项数=1, 已领项数=1, 提交人=N'admin', 提交时间=SYSDATETIME()
   WHERE id=${ledgerId}`);
console.log(`② 台账 id=${ledgerId} 挂到 ${outNo}(工单 ${woNo} 第 ${woLine} 行)`);

// ── ③ 真实手机退料接口(退 3 个)
const ret = await post('/api/px/mobilePick/submitReturn', { id: ledgerId, items: [{ code: MATERIAL, qty: 3 }] });
const backNo = ret?.data?.退料单号 || ret?.data?.单据编号 || '';
console.log(`③ 手机退料提交: ${okOf(ret) ? '✅' : '❌'} 退料单号=${backNo} ${okOf(ret) ? '' : JSON.stringify(ret).slice(0, 400)}`);
if (!backNo) { await pool.close(); process.exit(1); }

// ── ④ 校验落库:单据类型/工单号/工单行号/业务类型/状态
const head = (await q(`SELECT 单据编号, 业务类型, 加工单号, 工单行号, 备注, 是否已转ERP, ERP单号 FROM bd_material_ret WHERE 单据编号=N'${backNo}'`))[0] || {};
const line = (await q(`SELECT 材料编码, 数量, 单价, 金额, 仓库编码, 明细备注 FROM bl_material_ret WHERE 单据编号=N'${backNo}'`))[0] || {};
const st = (await q(`SELECT shr, shsj FROM yj_doc_status WHERE panel_code=N'MATERIAL_RET' AND doc_no=N'${backNo}'`))[0] || {};
const after = await q(`SELECT ISNULL(yl,0) yl FROM kucun WHERE wzdm=N'${MATERIAL}' AND ckdm=N'${WH_CODE}' AND ISNULL(lot_no,'')=''`);
const stockAfter = after.length ? Number(after[0].yl) : 0;

console.log(`④ 落库: 业务类型=${head.业务类型} 工单号=${head.加工单号} 工单行号=${head.工单行号} 审核人=${st.shr || '(空)'}`);
console.log(`   明细: ${line.材料编码} 数量=${line.数量} 单价=${line.单价 || 0} 金额=${line.金额 || 0} 仓库=${line.仓库编码}`);
console.log(`   库存: ${stockBefore} → ${stockAfter}(${stockAfter - stockBefore >= 0 ? '+' : ''}${(stockAfter - stockBefore).toFixed?.(4) ?? stockAfter - stockBefore})`);

// ── ⑤ 转ERP(生产退料单 → 金蝶 inv_pick_ret)
const push = await call('MATERIAL_RET', '转ERP', { 单据编号: backNo, 编号: backNo });
const erpNo = push?.data?.ERP单号 || '';
console.log(`⑤ 转ERP: ${okOf(push) && erpNo ? '✅' : '❌'} ERP单号=${erpNo || '(无)'} ${(push?.data?.message || push?.message || '').slice(0, 300)}`);

await pool.close();
const pass = okOf(ret) && head.加工单号 === woNo && Number(head.工单行号) === woLine
  && head.业务类型 === '生产退料' && st.shr && (stockAfter - stockBefore) === 3 && !!erpNo;
console.log(`\n结论: ${pass ? '✅ PASS' : '❌ FAIL'} —— 退料单=${backNo} 工单=${head.加工单号} 行=${head.工单行号} 库存+${(stockAfter - stockBefore).toFixed?.(4) ?? ''} ERP=${erpNo || '-'}`);
