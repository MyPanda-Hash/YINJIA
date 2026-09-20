/** _q-src-doc.mjs — 只读排查:源测试入库单在 API 里的形态(detail.items 是否下发) */
const API = 'http://127.0.0.1:8091/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
const res = await (await fetch(API + '/px/queryFormDataList', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 200 }),
})).json();
const list = res.data?.list || [];
console.log('总行数 =', list.length);
for (const r of list.slice(0, 6)) {
  const no = r['编号'] || r['单据编号'];
  const det = r['detail'];
  console.log(`${no} | keys=${Object.keys(r).length} | detail=${det ? Object.keys(det).join(',') : '(无)'} | items=${(det?.items || []).length} | 状态=${r['单据状态']} ERP单号=${r['ERP单号'] || ''}`);
}
