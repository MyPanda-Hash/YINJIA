/** 打印 MANU_ORDER 的 buttonGroups 原文 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = login.data.token;
  const res = await fetch(API + '/px/getPanelConfig?panelCode=MANU_ORDER', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  const d = res.data || {};
  console.log('顶层键: ' + Object.keys(d).join(','));
  console.log('buttonGroups(顶层): ' + JSON.stringify(d.buttonGroups || null));
  console.log('buttonGroups(metadata): ' + JSON.stringify(d.metadata?.buttonGroups || null).slice(0, 1200));
  console.log('panelButtons: ' + JSON.stringify(d.metadata?.panelButtons || null).slice(0, 300));
})();
