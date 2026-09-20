/**
 * _verify-select-audited-only.mjs — 口径实测:选单来源与生单**只认「已审核」**
 * 用法: node tools/archive/_verify-select-audited-only.mjs
 * 断言:
 *  ① /px/voucherFlow/sources(PU_ORDER→SL_RECV)对指定单号:已审核的返回、已完成的**不返回**;
 *  ② 列表里绝不出现 已完成/已中止/草稿 单据;
 *  ③ 对「已完成」单直接点「生成送料暂收单」→ 被拒且提示"仅已审核"。
 */
const API = 'http://localhost:8090/api';
const DONE_DOC = 'YJ-20260916-02';   // 金蝶已关闭 → MES 已完成
const OK_DOC = 'YJ-20260916-01';     // 金蝶未关闭 → MES 已审核

const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
if (!token) throw new Error('登录失败');
const post = async (path, body) => (await (await fetch(API + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body),
})).json());

const fails = [];
const ok = (c, m, extra = '') => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${m}${extra ? ' :: ' + extra : ''}`); if (!c) fails.push(m); };

// ① 选单来源:指定单号逐个探
console.log('=== ① 选单来源(/voucherFlow/sources) ===');
for (const no of [OK_DOC, DONE_DOC]) {
  const r = await post('/px/voucherFlow/sources', {
    sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV',
    condition: { 单据编号: no }, pageNo: 1, pageSize: 20,
  });
  const list = r.data?.list || [];
  const hit = list.find((x) => String(x['编号'] || x['单据编号']) === no);
  const st = hit ? hit['单据状态'] : '(未返回)';
  console.log(`   ${no} → ${hit ? '出现在选单来源,状态=' + st : '未出现'}`);
  if (no === OK_DOC) ok(!!hit && st === '已审核', `${no}(已审核)可选`, String(st));
  else ok(!hit, `${no}(已完成)不可选`, String(st));
}

// ② 整页扫描:不得出现非「已审核」
console.log('\n=== ② 选单来源整页扫描(不得含非已审核)===');
const page = await post('/px/voucherFlow/sources', {
  sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', condition: {}, pageNo: 1, pageSize: 300,
});
const rows = page.data?.list || [];
const bad = rows.filter((x) => String(x['单据状态']) !== '已审核');
console.log(`   返回 ${rows.length} 张,状态分布: ${[...new Set(rows.map((x) => x['单据状态']))].join(' / ')}`);
ok(rows.length > 0, '选单来源非空(有可选项)');
ok(bad.length === 0, '全部为「已审核」(无 已完成/已中止/草稿 混入)', bad.slice(0, 3).map((x) => `${x['编号']}:${x['单据状态']}`).join(','));

// ③ 生单:对已完成单直接生单 → 必须被拒
console.log('\n=== ③ 生单(生成送料暂收单)对已完成单 ===');
const gen = await post('/px/callButton', {
  panelCode: 'PU_ORDER', buttonName: '生成送料暂收单', formData: { 编号: DONE_DOC }, buttonParam: {},
});
const msg = String(gen.message || '');
console.log(`   响应: code=${gen.code} message=${msg.slice(0, 120)}`);
ok(gen.code !== 0 && gen.code !== 200, '已完成单生单被拒绝', `code=${gen.code}`);
ok(/仅已审核/.test(msg), '拒绝原因=仅已审核可生单', msg.slice(0, 80));

console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
fails.forEach((f) => console.log('  ✗', f));
if (fails.length) process.exitCode = 1;
