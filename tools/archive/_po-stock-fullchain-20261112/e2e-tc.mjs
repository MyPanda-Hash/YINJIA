// 探针(2026-11-12):验证「暂收退回单审核 → 特采单 → 审批 → 采购入库单」这条支路是否带出现存量
// **只在测试账套 YJ_TEST 跑**。用法:
//   node tools/archive/_po-stock-fullchain-20261112/e2e-tc.mjs TH-2026-11-0001
const base = 'http://127.0.0.1:8090';
const retNo = process.argv[2] || 'TH-2026-11-0001';

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

const btn = async (panel, name) => {
  const r = await j('/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName: name, formData: { 编号: retNo, 单据编号: retNo } }),
  });
  console.log(`${panel} ${name}:`, JSON.stringify(r).slice(0, 300));
  return r;
};

// ① 退料单审核(→ 自动生成特采单,只对勾了「特采」的行)
await btn('QC_RETURN', '审核');
// ② 列生成的特采单
const cfg = await j('/api/px/getPanelConfig?panelCode=QC_TC_IN', { headers: H });
console.log('特采单面板可访问:', cfg.code);
