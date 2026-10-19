/** 打印某面板工具栏按钮组(看「新增」到底挂的是哪个动作,2026-10-19) */
const API = 'http://127.0.0.1:8090/api';
const panel = process.argv[2] || 'QC_INSP';
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
const cfg = await (await fetch(`${API}/px/getPanelConfig?panelCode=${panel}`, { headers: H })).json();
const meta = cfg?.data?.metadata || {};
console.log(`== ${panel} ==`);
console.log('  singleDoc =', meta.singleDoc, ' formPages =', (meta.formPages || []).length);
for (const g of meta.buttonGroups || []) {
  console.log('  组:', g.name, '→', (g.actions || g.items || []).join(' | '));
}
