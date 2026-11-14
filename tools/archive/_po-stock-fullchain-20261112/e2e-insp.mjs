// 探针(2026-11-12):验证「检验单审核 → 自动生成 采购入库单 / 暂收退回单」两条自动路径是否带出现存量
// **只在测试账套 YJ_TEST 跑**。用法:
//   node tools/archive/_po-stock-fullchain-20261112/e2e-insp.mjs IJ-2026-10-0054
const base = 'http://127.0.0.1:8090';
const inspNo = process.argv[2] || 'IJ-2026-10-0054';

const j = async (url, opt) => {
  const r = await fetch(base + url, opt);
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(`${url} 非 JSON: ${t.slice(0, 300)}`); }
};
const login = await j('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
});
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };
const au = await j('/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_INSP', buttonName: '审核', formData: { 编号: inspNo, 单据编号: inspNo } }),
});
console.log('审核检验单:', JSON.stringify(au).slice(0, 600));
