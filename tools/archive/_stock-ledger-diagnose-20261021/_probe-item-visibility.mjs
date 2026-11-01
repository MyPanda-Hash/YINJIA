// 探针:同一个物料在三个库存面板里的可见性对比
const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.log('login failed'); process.exit(1); }

async function q(panelCode, condition = {}, pageSize = 200) {
  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition, pageNo: 1, pageSize }),
  });
  const j = await r.json();
  return { total: j?.data?.totalSize, rows: j?.data?.list || [] };
}

const ITEM = 'YJ-YCYX-055';
const CK = 'CK00006';

for (const [panel, cond] of [
  ['STOCK_DETAIL', { 存货编码: ITEM }],
  ['STOCK_STATUS', { 存货编码: ITEM }],
  ['STOCK_BALANCE', { 存货编码: ITEM }],
  ['STOCK_LEDGER', { 存货编码: ITEM }],
]) {
  const res = await q(panel, cond);
  console.log(`\n=== ${panel} 存货编码=${ITEM} === totalSize=${res.total} rows=${res.rows.length}`);
  for (const row of res.rows.slice(0, 6)) console.log('  ', JSON.stringify(row).slice(0, 260));
}

// 库存明细总数 & 该仓库数量(与用户看到的 0 条对比)
const all = await q('STOCK_DETAIL', {}, 1);
const ck = await q('STOCK_DETAIL', { _whCodes: CK }, 1);
console.log('\nSTOCK_DETAIL 全部 totalSize=' + all.total + ' ; 只 CK00006 totalSize=' + ck.total);
