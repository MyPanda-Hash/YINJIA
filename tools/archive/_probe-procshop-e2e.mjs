/** ProcessShop 端到端验证(测试账套 YJ_TEST):
 *  装箱 → 成型线 必须被拒;装箱 → 组装线 必须放行。
 *  造数/收尾见 tools/archive/_probe-procshop-*.sql。 */
const base = 'http://127.0.0.1:8090/api';
const lg = await (await fetch(base + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
const token = lg?.data?.token;
if (!token) { console.log('[FAIL] 测试账套登录失败', JSON.stringify(lg).slice(0, 200)); process.exit(1); }
console.log('login YJ_TEST ok');
const call = async (p, b) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(b || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const NO = 'GD2608100002';
let fail = 0;

// ① 弹窗口径:装箱的归口车间应是「组装」
const rs = await call('/px/scheduleBoard/routeSteps', { 加工单号: NO });
const steps = rs.body?.data?.['工序步骤'] || [];
console.log('routeSteps:', steps.map((s) => `${s['工序']}(${s['生产车间'] || '空'})`).join(' → '));
const box = steps.find((s) => s['工序'] === '装箱');
if (!box || box['生产车间'] !== '组装') { console.log('[FAIL] 装箱 生产车间 应为「组装」'); fail++; }

// ② 反例:装箱 → 2号车间(成型线)必须被拒
const bad = await call('/px/scheduleBoard/preplan', {
  加工单号: NO,
  步骤: [{ 工序: '成型', 生产线: '1号机' }, { 工序: '装箱', 生产线: '2号车间' }],
});
console.log('反例(装箱→成型线):', bad.status, bad.body?.message || '');
if (bad.status === 200) { console.log('[FAIL] 装箱竟能进成型线'); fail++; }

// ③ 正例:组装/装箱都进组装车间的线(成型→1号机;装箱→组装1(老厂))
const ok = await call('/px/scheduleBoard/preplan', {
  加工单号: NO, 排产数量: 100,
  步骤: [{ 工序: '成型', 生产线: '1号机' }, { 工序: '装箱', 生产线: '组装1(老厂)' }],
});
console.log('正例(装箱→组装1(老厂)):', ok.status, JSON.stringify(ok.body?.data ?? ok.body?.message ?? '').slice(0, 300));
if (ok.status !== 200) { console.log('[FAIL] 装箱进组装线被拒'); fail++; }

// ④ 台账落库核对(行级:带行id,只看这一行)
const led = await call('/px/scheduleBoard/routeSteps', { 加工单号: NO, 行id: 2 });
const planned = led.body?.data?.['已排台账'] || [];
console.log('已排台账:', planned.map((x) => `${x['工序']}:${x['计划生产线']}(${x['状态']})`).join(' | '));
const boxLed = planned.find((x) => x['工序'] === '装箱');
if (!boxLed || boxLed['计划生产线'] !== '组装1(老厂)') { console.log('[FAIL] 装箱的预排线没落到组装1(老厂)'); fail++; }

console.log(fail ? `[FAIL] ${fail} 项不符` : '[PASS] 装箱与组装同进组装线;成型线被拒');
process.exit(fail ? 1 : 0);
