// 探针:直接问服务端「库存明细(STOCK_DETAIL)」现在返回多少行
// 用法: node _probe-stockdetail.mjs [http://127.0.0.1:8090]
const BASE = process.argv[2] || 'http://127.0.0.1:8090';

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  });
  const j = await r.json();
  if (!j?.data?.token) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300));
  return j.data.token;
}

const token = await login();
console.log('[login ok]', BASE);

async function q(panelCode, condition = {}, pageSize = 5) {
  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition, pageNo: 1, pageSize }),
  });
  const j = await r.json();
  const d = j.data || {};
  return { code: j.code ?? j.status, msg: j.message || j.msg, total: d.totalSize, rows: d.list || [] };
}

for (const panel of ['STOCK_DETAIL', 'STOCK_STATUS', 'STOCK_BALANCE']) {
  const res = await q(panel);
  console.log('\n=== ' + panel + ' ===');
  console.log('code=' + res.code, 'totalSize=' + res.total, 'rows=' + res.rows.length, res.msg || '');
  for (const row of res.rows.slice(0, 3)) console.log('  ', JSON.stringify(row).slice(0, 220));
}

// 带仓库条件再查一次(与界面左栏勾选等价)
const res2 = await q('STOCK_DETAIL', { _whCodes: 'CK00006' });
console.log('\n=== STOCK_DETAIL 只查 CK00006 ===');
console.log('totalSize=' + res2.total, 'rows=' + res2.rows.length, res2.msg || '');
for (const row of res2.rows.slice(0, 5)) console.log('  ', JSON.stringify(row).slice(0, 220));
