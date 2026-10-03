// 临时探针:getFormDescriptor 返回的表头键清单(QC_INSP)—— 查「暂收单号」为何取不到
const API = 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
const H = { Authorization: 'Bearer ' + lj.data.token };
const j = await (await fetch(`${API}/px/getFormDescriptor?panelCode=QC_INSP&code=IJ-2026-10-0050`, { headers: H })).json();
console.log('顶层键:', Object.keys(j.data || {}));
console.log('data 键:', Object.keys(j.data?.data || {}));
console.log('暂收单号=', JSON.stringify(j.data?.data?.['暂收单号']), ' 批次号=', JSON.stringify(j.data?.data?.['批次号']));
console.log('schema 字段数:', (j.data?.schema?.fields || j.data?.dataSchema?.fields || []).length);
