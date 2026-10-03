// _wh-data-check.cjs — 验证 WH queryFormDataList 行数据带 库位 列
const BASE = 'http://127.0.0.1:8090';
(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then(r => r.json());
  const tok = login.data.token;
  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelCode: 'WH', pageNo: 1, pageSize: 10 }),
  }).then(r => r.json());
  if (r.code !== 200) { console.log('FAIL code=' + r.code + ' msg=' + r.message); process.exit(1); }
  const rows = r.data.rows || r.data.list || r.data;
  console.log('RAW data keys: ' + (r.data && typeof r.data === 'object' ? Object.keys(r.data).join(',') : typeof r.data));
  console.log(JSON.stringify(r.data, null, 1).substring(0, 1500));
  for (const row of rows) {
    console.log(`${row['仓库编码']} ${row['仓库名称']} 库位=${JSON.stringify(row['库位'])}`);
  }
  console.log('has 库位 key: ' + ('库位' in rows[0]));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
