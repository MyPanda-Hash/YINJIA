/**
 * 只读体检探针:直接从 MES 接口看「结案异常 / 未结案 / 最近新建的工单行」。
 * 不需要登服务器、不碰数据库,只需要一个能登录的账号。
 *
 * 用法:
 *   node _api-check.mjs http://36.140.66.163:8090 admin 123456
 *   node _api-check.mjs http://127.0.0.1:8090 admin 123456
 *
 * 说明:手机端小程序是**直连库**写 scjl/plang 的,不走 MES 接口,所以这里只能看
 *       "它写进来的结果"——新建的工单行、变成结案异常的行。要看到报工行原文(scjl)必须用 SQL。
 */

const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456'] = process.argv.slice(2);

async function post(path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`); }
}

const login = await post('/api/auth/login', { userName: user, password: pass });
if (!login?.data?.token) {
  console.log('登录失败:', JSON.stringify(login).slice(0, 300));
  process.exit(2);
}
const token = login.data.token;

const list = await post('/api/px/workOrderList', {}, token);
const rows = list?.data ?? [];
const audit = await post('/api/px/workOrderList/closeAudit', {}, token);
const bad = audit?.data ?? [];

const orderOf = (x) => x['工单号'];
const closed = rows.filter((x) => x['结案'] === 'Y');
const unclosed = rows.filter((x) => x['结案'] !== 'Y');

// 最近建单(按转单时间倒序)前 10
const recent = [...rows].sort((a, b) => String(b['转单时间'] || '').localeCompare(String(a['转单时间'] || ''))).slice(0, 10);

// 工单号+行号 重复
const bucket = new Map();
for (const x of rows) {
  const k = orderOf(x) + '#' + x['工单行号'];
  bucket.set(k, (bucket.get(k) || 0) + 1);
}
const dup = [...bucket.entries()].filter(([, n]) => n > 1);

console.log('=== ' + base + ' ===');
console.log(`在册工单行 ${rows.length} | 结案 ${closed.length} | 未结案 ${unclosed.length} | 结案异常 ${bad.length} | 重复(工单号#行号) ${dup.length}`);
if (dup.length) console.log('  重复:', dup.slice(0, 5).map(([k, n]) => k + ' × ' + n).join(', '));

console.log('\n-- 结案异常(点「结案回正」会清掉这些) --');
if (!bad.length) console.log('  (无)');
for (const x of bad.slice(0, 15)) {
  console.log(`  ${x['工单号']}#${x['工单行号']}  排产 ${x['排产数量']}  入库 ${x['入库数量']}  ja=${x['ja']}  最后修改人=${x['最后修改人'] || '(空)'}  ${x['最后修改时间'] || ''}`);
}

console.log('\n-- 最近 10 行建单(转单时间) --');
for (const x of recent) {
  console.log(`  ${x['工单号']}#${x['工单行号']}  ${x['转单时间'] || ''}  客户 ${x['客户代码'] || ''}  排产 ${x['排产数量']}  入库 ${x['入库数量']}  产线 ${x['生产线'] || '(空)'}  状态 ${x['生产状态']}`);
}

console.log('\n-- 未结案的工单行 --');
if (!unclosed.length) console.log('  (无)');
for (const x of unclosed.slice(0, 20)) {
  console.log(`  ${x['工单号']}#${x['工单行号']}  排产 ${x['排产数量']}  入库 ${x['入库数量']}  产线 ${x['生产线'] || '(空)'}  完工状态 ${x['完工状态'] || '(空)'}  生产状态 ${x['生产状态']}`);
}
