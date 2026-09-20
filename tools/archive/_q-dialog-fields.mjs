/**
 * _q-dialog-fields.mjs — 打印 7 个面板「查询」弹窗真实渲染的字段(表单页 fieldNames)及其参照关联现状
 * 用法: node tools/archive/_q-dialog-fields.mjs
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const PANELS = ['PU_ORDER', 'SL_RECV', 'QC_RETURN', 'QC_INSP', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT'];

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败'); process.exit(1); }
const H = { Authorization: 'Bearer ' + token };

for (const pc of PANELS) {
  const r = await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`, { headers: H })).json();
  const cfg = r?.data || {};
  const fields = cfg?.dataSchema?.fields || [];
  const names = cfg?.metadata?.panelPageDto?.formPages?.[0]?.fieldNames || '';
  const order = String(names).split(',').map((s) => s.trim()).filter(Boolean);
  const byName = new Map(fields.map((f) => [f.dataName || f.name || f.label, f]));
  const list = order.length ? order.map((n) => byName.get(n)).filter(Boolean) : fields.filter((f) => !f.hidden);
  console.log(`\n=== ${pc} 查询弹窗字段(${list.length} 个;来源=${order.length ? 'formPages[0].fieldNames' : '全部非隐藏字段'}) ===`);
  for (const f of list) {
    const key = f.dataName || f.label;
    if (key === '备注') continue;
    const ref = f.refPanel ? `→ 参照 ${f.refPanel}.${f.refField}/${f.displayField}` : (f.options ? `下拉(${(f.options || []).length} 项)` : '');
    console.log(`  ${key.padEnd(12)} | ${String(f.dataType).padEnd(4)} ${ref}${f.refMap ? ' refMap=' + JSON.stringify(f.refMap) : ''}`);
  }
}
