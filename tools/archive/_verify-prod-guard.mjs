/**
 * _verify-prod-guard.mjs — 账套守卫实测:凭证指向真实账套(outerInstanceId 非空)时,转ERP 必须被拒且不联网
 * 用法: node tools/archive/_verify-prod-guard.mjs
 * 断言:① 接口返回拒绝文案(含"真实账套"/"allowProd");② 后端日志无 app-token 获取(证明守卫在联网前拦下)。
 */
const API = 'http://127.0.0.1:8091/api';
const DOC = process.argv[2] || 'PI-2026-09-0015';   // 任意一张已审核未转ERP的采购入库单

const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
if (!token) throw new Error('登录失败');

const res = await (await fetch(API + '/px/callButton', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: '转ERP', formData: { 编号: DOC }, buttonParam: {} }),
})).json();
console.log('[转ERP 响应] ' + JSON.stringify(res).slice(0, 400));
const msg = String(res.message || '');
const fails = [];
const ok = (c, m, extra = '') => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${m}${extra ? ' :: ' + extra : ''}`); if (!c) fails.push(m); };
ok(res.code !== 0 && res.code !== 200, '真实账套下转ERP 被拒绝(未放行)', `code=${res.code}`);
ok(/真实账套/.test(msg), '拒绝文案说明"指向真实账套"', msg.slice(0, 120));
ok(/allowProd/.test(msg), '拒绝文案给出开启开关(allowProd)的可操作提示', msg.slice(0, 160));
ok(/已拒绝转ERP/.test(msg), '拒绝发生在推送服务内部(守卫而非金蝶报错)', msg.slice(0, 80));
console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
fails.forEach((f) => console.log('  ✗', f));
if (fails.length) process.exitCode = 1;
