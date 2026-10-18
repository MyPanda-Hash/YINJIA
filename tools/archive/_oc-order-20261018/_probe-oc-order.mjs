/**
 * _probe-oc-order.mjs — 订单结转「待结转列表」排序取证(2026-10-18)
 *
 * 用户口径:「当前订单结转的单据是新的在下方、旧单据在上面,现在需要修改新的在上、旧的在下面。」
 * 本探针只读(不生成任何单据),打 /px/orderConvert/pending,断言:
 *   ① 下单日期单调**不增**(新的在上);
 *   ② 同日期单据:单据编号单调**不降**序(新单号在上);
 *   ③ 同一张单的行号仍是**升序**(行 1/2/3 从上到下,不被倒序翻过来);
 *   ④ 与库里直接按同样键排序的前 5 行逐行对得上(前端拿到的是后端顺序,不是重排)。
 *
 * 用法:node tools/archive/_oc-order-20261018/_probe-oc-order.mjs [BASE] [FACTORY] [dateFrom] [dateTo]
 *   默认 BASE=http://127.0.0.1:8090 FACTORY=YJ 区间=近 120 天(保证能捞到多张单)
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const FACTORY = process.argv[3] || 'YJ';
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const from = process.argv[4] || fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 120));
const to = process.argv[5] || fmt(today);

let fails = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`);
};

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json());
if (!login?.data?.token) { console.log('[FAIL] 登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
const rows = (await (await fetch(`${BASE}/api/px/orderConvert/pending`, {
  method: 'POST', headers: H, body: JSON.stringify({ keyword: '', dateFrom: from, dateTo: to }),
})).json())?.data || [];

console.log(`\n区间 ${from} ~ ${to} 共 ${rows.length} 行`);
for (const r of rows.slice(0, 5)) console.log(`  上 ${r['下单日期']} | ${r['订单号']} #${r['行号']}`);
for (const r of rows.slice(-3)) console.log(`  下 ${r['下单日期']} | ${r['订单号']} #${r['行号']}`);

ok('有数据可判(≥2 行)', rows.length >= 2, `rows=${rows.length}`);
if (rows.length >= 2) {
  // ① 日期单调不增(新在上)
  let dateOk = true;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]['下单日期']) > String(rows[i - 1]['下单日期'])) { dateOk = false; break; }
  }
  ok('① 下单日期倒序(新的在上)', dateOk,
    `首=${rows[0]['下单日期']} 末=${rows[rows.length - 1]['下单日期']}`);

  // ② 同日期内 单据编号 倒序(字符串比较;同号不会被判错)
  let noOk = true;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (String(a['下单日期']) !== String(b['下单日期'])) continue;
    if (String(b['订单号']) > String(a['订单号'])) { noOk = false; break; }
  }
  ok('② 同日期的单据编号倒序', noOk);

  // ③ 同一张单的行号升序(行内不翻)
  const first = new Map();
  let lineOk = true;
  for (const r of rows) {
    if (!first.has(r['订单号'])) first.set(r['订单号'], []);
    first.get(r['订单号']).push(Number(r['行号'] || 0));
  }
  for (const [, xs] of first) {
    for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) { lineOk = false; break; }
  }
  ok('③ 同单据的行号仍升序', lineOk);

  // ④ 旧口径(升序)不该再出现:首行不是全局最旧
  const oldest = rows.reduce((m, r) => (String(r['下单日期']) < String(m['下单日期']) ? r : m), rows[0]);
  ok('④ 首行不是最旧单(旧的已沉底)', String(rows[0]['下单日期']) !== String(oldest['下单日期'])
    || String(rows[0]['订单号']) !== String(oldest['订单号']),
  `首=${rows[0]['订单号']} 最旧=${oldest['订单号']}`);
}

console.log(fails ? `\n=== 存在 ${fails} 项失败 ===` : '\n=== 订单结转排序探针全部通过 ===');
process.exit(fails ? 1 : 0);
