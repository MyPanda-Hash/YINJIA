// 探针(2026-11-12):特采单 审核/审批 → 采购入库单,核验入库行是否带出「现存量」
// **只在测试账套 YJ_TEST 跑**。用法:
//   node tools/archive/_po-stock-fullchain-20261112/e2e-tc2.mjs TCI-2026-11-0001
const base = 'http://127.0.0.1:8090';
const tcNo = process.argv[2] || 'TCI-2026-11-0001';
const names = process.argv.slice(3);

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

for (const name of (names.length ? names : ['审核'])) {
  const r = await j('/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_TC_IN', buttonName: name, formData: { 编号: tcNo, 单据编号: tcNo } }),
  });
  console.log(`QC_TC_IN ${name}:`, JSON.stringify(r).slice(0, 400));
  if (r.code !== 200) break;
}
