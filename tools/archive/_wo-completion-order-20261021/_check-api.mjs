const BASE = 'http://127.0.0.1:8090';
const factory = process.env.FACTORY || 'YJ';
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
})).json();
const token = login?.data?.token;
if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 300));
const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'WO_COMPLETION_LIST', pageNo: 1, pageSize: 100 }),
});
const j = await r.json();
const rows = j?.data?.list || [];
console.log(factory, 'total=', j?.data?.totalSize, 'rows=', rows.length);
let prev = null, ok = true;
for (const [i, x] of rows.entries()) {
  const t = x['完工时间'];
  if (prev !== null && String(t) > String(prev)) ok = false;
  if (i < 8 || i >= rows.length - 3) console.log(String(i + 1).padStart(3), t, x['报工单号'] || '-', x['工序'] || '-', x['工单号']);
  prev = t;
}
console.log(ok ? '[PASS] 完工时间非递增:新日期在上、旧日期在下' : '[FAIL] 顺序不对');
console.log('first=', rows[0]?.['完工时间'], 'last=', rows[rows.length-1]?.['完工时间']);
