/**
 * 取号预览核对(2026-10-19):
 * GET /px/getNewFormPermMatrix 会用 FormNoService.preview() 填新建表单的默认单号,
 * 因此它显示的号 = "现在点新增会拿到的号"。用它验证 生产工单(GD, 号在 plang 而非面板表)是否已经避开旧号。
 *
 * 用法:node _preview-no.mjs [host:port] [PANEL ...]
 */
const host = process.argv[2] || '127.0.0.1:8090';
const panels = process.argv.slice(3).length ? process.argv.slice(3) : ['MANU_ORDER', 'QC_RECV', 'QC_INSP'];
const API = `http://${host}/api`;
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { Authorization: 'Bearer ' + login.data.token };
for (const p of panels) {
  const r = await fetch(`${API}/px/getNewFormPermMatrix?panelCode=${p}&operationName=${encodeURIComponent('新增流程')}`, { headers: H });
  const j = await r.json().catch(() => ({}));
  const d = j?.data?.data || {};
  const no = Object.entries(d).find(([k]) => ['合同号', '单号', '单据编号', '编号'].includes(k));
  console.log(`${p.padEnd(12)} HTTP ${r.status} 预览号=${no ? no[1] : JSON.stringify(d).slice(0, 80)}`);
}
