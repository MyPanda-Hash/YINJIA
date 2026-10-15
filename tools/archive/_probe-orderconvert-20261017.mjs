/**
 * _probe-orderconvert-20261017.mjs — 看正式账套「订单结转」待结转池与可选工艺路线(只读)。
 * 用途:为造一份可走通的生产链(工单→排产→报工)挑素材。
 * 用法:node tools/archive/_probe-orderconvert-20261017.mjs [FACTORY=YJ]
 */
const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090';
const FACTORY = process.argv[2] && !process.argv[2].startsWith('http') ? process.argv[2] : 'YJ';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json());
if (!login?.data?.token) { console.log('[FAIL] 登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
console.log(`[OK] 登录账套 ${FACTORY}`);
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
const post = async (p, b) => (await (await fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) })).json());

const pend = await post('/px/orderConvert/pending', {});
const rows = pend?.data || [];
console.log(`\n待结转行 ${rows.length} 条`);
if (rows.length) {
  console.log('字段:', Object.keys(rows[0]).join(', '));
  for (const r of rows.slice(0, 6)) {
    console.log('  ' + Object.entries(r).filter(([k]) => /订单号|行id|存货|数量|剩余|客户|交期|工艺/.test(k)).map(([k, v]) => `${k}=${v}`).join(' | '));
  }
}

const routes = await post('/px/processTask/routes', {});
const rr = routes?.data || [];
console.log(`\n工艺路线 ${rr.length} 条`);
for (const r of rr.slice(0, 8)) console.log('  ' + JSON.stringify(r).slice(0, 200));
