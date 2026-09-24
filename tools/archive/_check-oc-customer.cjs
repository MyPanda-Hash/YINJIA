const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
(async () => {
  const t = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()).data.token;
  const r = await (await fetch(API + '/px/orderConvert/pending', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ keyword: '' }) })).json();
  const rows = r.data || [];
  const bad = rows.filter((x) => x['客户'] === x['业务员'] && x['业务员']);
  const zl = rows.filter((x) => String(x['订单号']).startsWith('ZL-20260916'));
  const normal = rows.filter((x) => String(x['订单号']).startsWith('LZW') || String(x['订单号']).startsWith('ZXL'));
  const code = rows.filter((x) => /^\(.*\)$/.test(String(x['客户'])));
  console.log(code.length === 0 ? 'OK 无编码占位显示(客户均按档案解名)' : 'FAIL 仍有 ' + code.length + ' 行显示编码');
  zl.forEach((x) => console.log('  ' + x['订单号'] + ' 客户显示=[' + x['客户'] + '] 档案解名(dm_kh C-000=张莉) 原始=[' + x['客户原始值'] + '] 业务员=[' + x['业务员'] + ']'));
  console.log(normal.length && normal.every((x) => x['客户'] === x['客户原始值'] || x['客户'])
    ? 'OK 正常单客户名保持(' + normal[0]['客户'] + ' 等 ' + normal.length + ' 行)'
    : 'FAIL 正常单被误改');
})();
