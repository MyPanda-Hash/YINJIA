// 一次性探查:各面板参照字段的 ref.map(带回映射)——问题5/6 定位
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  }).then(r => r.json());
  const token = login.data.token;
  for (const [panel, op] of [['PU_ORDER', '新增流程'], ['SL_RECV', '新增流程'], ['QC_INSP', '新增流程'], ['PURCHASE_IN', '新增']]) {
    const r = await fetch(`${BASE}/px/getNewFormPermMatrix?panelCode=${panel}&operationName=${encodeURIComponent(op)}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json());
    const metas = (r.data && r.data.meta) || [];
    const refFields = metas.filter(m => m.ref && (m.ref.map || m.ref.refField || m.ref.displayField));
    console.log(`\n===== ${panel} 参照字段 =====`);
    for (const m of refFields) {
      console.log(`${m.dataName}: refPanel=${m.ref.refPanel || m.ref.panel} refField=${m.ref.refField} display=${m.ref.displayField} map=${JSON.stringify(m.ref.map)}`);
    }
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
