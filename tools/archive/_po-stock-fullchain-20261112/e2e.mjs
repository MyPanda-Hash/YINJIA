// 探针(2026-11-12):采购链「现存量」端到端贯通验证 —— **只在测试账套 YJ_TEST 跑**
// 路径:暂收单审核 → 生单(检验/入库)→ 打印生成单的行值;随后用 sqlcmd 核对 现存量 是否随链带下。
// 用法: node tools/archive/_po-stock-fullchain-20261112/e2e.mjs SL-2026-09-0021
const base = 'http://127.0.0.1:8090';
const sourceNo = process.argv[2] || 'SL-2026-09-0021';

const j = async (url, opt) => {
  const r = await fetch(base + url, opt);
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(`${url} 非 JSON: ${t.slice(0, 300)}`); }
};

const login = await j('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
});
if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 300));
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };
console.log(`登录 OK,YJ_TEST`);

// ① 审核暂收单(草稿 → 已审核;生单前置)
const au = await j('/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: sourceNo, 单据编号: sourceNo } }),
});
console.log('审核暂收:', JSON.stringify(au).slice(0, 500));

// ② 预览可生单行
const prev = await j('/api/px/push/lines', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [sourceNo] }),
});
const doc = (prev.data?.docs || [])[0];
if (!doc) throw new Error('预览无候选单: ' + JSON.stringify(prev).slice(0, 400));
console.log(`预览:状态=${doc.status} 候选行=${doc.lines?.length} target=${prev.data.targetPanel}`);
const lines = (doc.lines || []).map((l) => ({
  lineKey: l.lineKey,
  qty: l.剩余数量 ?? l.数量 ?? l.qty ?? 0,
}));
console.log('  行键/数量:', JSON.stringify(lines));

// ③ 生单
const gen = await j('/api/px/push/generate', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo, lines }] }),
});
console.log('生单:', JSON.stringify(gen).slice(0, 800));
