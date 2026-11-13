/**
 * 端到端验证(2026-11-13):两张新补的退货类单据 + 暂收退回单 → 真金蝶沙箱
 *
 * 覆盖:新增(保存) → 审核 → 转ERP → 回读 MES 的 ERP单号
 * 边界:会话 = **测试账套**(factory YJ_TEST → HSDZ_MES_TEST);推送目标 = deploy/push/config.json 的**沙箱**
 *      (华实创新 579046204055359488),正式库 HSDZ_MES 与客户真实账套都不动。
 *
 * 用法: node tools/archive/_ret-docs-20261113/verify-return-erp-e2e.mjs [只跑哪个: SALE_IN|MATERIAL_RET|QC_RETURN]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js';

const BASE = process.env.YJ_API || 'http://127.0.0.1:8091';
const ONLY = process.argv[2] || '';
const today = new Date().toISOString().slice(0, 10);

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
if (!login?.data?.token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
const token = login.data.token;
console.log(`✅ 测试账套会话已建立(${login.data.user?.userName || 'admin'}) @ ${BASE}`);

const call = async (panelCode, buttonName, formData, buttonParam = {}) => {
  const r = await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode, buttonName, formData, buttonParam }),
  })).json();
  return r;
};
const okOf = (r) => r?.code === 0 || r?.code === 200;
const pickNo = (r) => r?.data?.单据编号 || r?.data?.编号 || r?.data?.data?.单据编号 || '';

// 沙箱里确实存在、且有库存的档案(2026-11-13 实测)
const CASE = {
  SALE_IN: {
    label: '销售退货单',
    head: 'bd_sale_in', line: 'bl_sale_in',
    form: {
      单据日期: today, 客户: '长江', 客户编码: '001', 仓库: '半成品仓', 退货原因: 'E2E 退货验证',
      detail: { items: [{ 存货编码: 'C-95-13', 存货名称: '006项目/功能炭棒滤芯', 数量: 5, 售价: 10, 成本价: 8,
        计量单位: '个', 仓库编码: 'CK04', 仓库: '半成品仓' }] },
    },
  },
  MATERIAL_RET: {
    label: '生产退料单',
    head: 'bd_material_ret', line: 'bl_material_ret',
    form: {
      单据日期: today, 业务类型: '生产退料', 备注: 'E2E 退料验证',
      detail: { items: [{ 材料编码: 'CL002', 材料名称: '6061铝锭', 数量: 2, 单价: 5, 金额: 10,
        计量单位: '个', 仓库编码: 'CK04', 仓库: '半成品仓' }] },
    },
  },
  QC_RETURN: {
    label: '暂收退回单',
    head: 'qc_return', line: 'qc_return_detail',
    form: {
      单据日期: today, 供应商: 'GYS00014', 仓库: '恒亿仓', 退货原因: 'E2E 采购退货验证',
      detail: { items: [{ 物料编码: 'YJ-AJ-016-1', 物料名称: 'PP棉', 退货数量: 1, 计量单位: '个',
        单价: 5, 不良原因: 'E2E 验证' }] },
    },
  },
};

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST',
  user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});

const results = [];
for (const [panel, c] of Object.entries(CASE)) {
  if (ONLY && ONLY !== panel) continue;
  console.log(`\n===== ${c.label}(${panel})=====`);
  // ① 新增/保存
  const saved = await call(panel, '保存', c.form);
  const docNo = pickNo(saved);
  console.log(`  ① 保存: ${okOf(saved) ? '✅' : '❌'} ${docNo || '(无单号)'} ${okOf(saved) ? '' : JSON.stringify(saved).slice(0, 400)}`);
  if (!docNo) { results.push({ panel, label: c.label, docNo: '', step: 'save', ok: false, msg: JSON.stringify(saved).slice(0, 400) }); continue; }

  // ② 审核
  const aud = await call(panel, '审核', { 单据编号: docNo, 编号: docNo });
  const audOk = okOf(aud);
  console.log(`  ② 审核: ${audOk ? '✅' : '❌'} ${audOk ? '' : JSON.stringify(aud).slice(0, 400)}`);

  // ③ 转ERP
  const push = await call(panel, '转ERP', { 单据编号: docNo, 编号: docNo });
  const erpNo = push?.data?.ERP单号 || '';
  const ok = okOf(push) && !!erpNo;
  console.log(`  ③ 转ERP: ${ok ? '✅' : '❌'} ERP单号=${erpNo || '(无)'}  ${push?.data?.message || push?.message || ''}`.slice(0, 700));

  // ④ 回读
  const row = (await pool.request().query(
    `SELECT 单据编号, 是否已转ERP, ERP单号, 转ERP操作人 FROM ${c.head} WHERE 单据编号 = N'${docNo}'`)).recordset[0] || {};
  console.log(`  ④ MES 回读: 是否已转ERP=${row.是否已转ERP || '(空)'} ERP单号=${row.ERP单号 || '(空)'} 操作人=${row.转ERP操作人 || '(空)'}`);
  results.push({ panel, label: c.label, docNo, saved: okOf(saved), audited: audOk, pushed: ok, erpNo, wrote: row.ERP单号 || '', msg: (push?.data?.message || push?.message || '').slice(0, 300) });
}
await pool.close();

console.log('\n===== 汇总 =====');
for (const r of results) {
  console.log(`${r.label.padEnd(6)} ${String(r.docNo).padEnd(22)} 保存=${r.saved ? 'Y' : 'N'} 审核=${r.audited ? 'Y' : 'N'} 转ERP=${r.pushed ? 'Y' : 'N'} 回写=${r.wrote ? 'Y' : 'N'} ERP单号=${r.erpNo || '-'}`);
}
const okCnt = results.filter((r) => r.pushed && r.wrote).length;
console.log(`结论:${okCnt}/${results.length} 张单据真正推到金蝶并回写 ERP单号`);




