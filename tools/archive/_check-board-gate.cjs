const API = (process.argv[2] || 'http://127.0.0.1:8091') + '/api';
(async () => {
  const t = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()).data.token;
  const cfg = await (await fetch(API + '/px/getPanelConfig?panelCode=MANU_ORDER', { headers: { Authorization: 'Bearer ' + t } })).json();
  const flat = JSON.stringify(cfg);
  console.log('⑦ 排产按钮已下线=' + !flat.includes('"排产"'));
  console.log('⑦ 保留按钮齐全=' + (flat.includes('拆单') && flat.includes('首件完成通知') && flat.includes('生成采购申请') && flat.includes('生成产品批号')));
})();
