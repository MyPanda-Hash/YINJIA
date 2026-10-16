/**
 * _q-assy-done-row.mjs — 「完工的工单行不再留在组装(末道)工序里」的回归探针(2026-10-16 任务产物)。
 *
 * 用户口径:「当前生产工单完工后不会在最后的组装工序中去除,需要实现当前完工后组装内没有当前生产工单」
 * —— 依然按 **工单号 + 工单行号** 逐行判。
 *
 * 断言(只读接口,不改任何数据;默认拿 GD-2026-10-0007 行1 完工 / 行2 未完工 这一对做对照):
 *   ① 组装线 scheduled(未完工) **不含**完工行;② scheduled(已完工) **含**它(修前这里恒 0 行 —— 两套口径打架);
 *   ③ linesSummary(该线未交量)与 stats(总未完成量 / 该线今日负荷)把完工行剔除;
 *   ④ 同单**未完工**的行照旧在本线里(按行判,不误伤);
 *   ⑤ 生产工单列表与追溯**不剔除**(列表要看到完工状态、追溯是完整记录)。
 *
 * 用法(仓库根;8090 需在跑):
 *   node tools/archive/_wo-done-row-filter/_q-assy-done-row.mjs
 *   BASE=http://127.0.0.1:8090 LINE=装箱1(老厂) WO=GD-2026-10-0007 ROW=1127 node tools/archive/_wo-done-row-filter/_q-assy-done-row.mjs
 */
const BASE = (process.env.BASE || 'http://127.0.0.1:8090').replace(/\/$/, '');
const LINE = process.env.LINE || '装箱1(老厂)';        // 组装线(末道)
const OTHER = process.env.OTHER || '1号机';            // 同单另一行所在的成型线
const WO = process.env.WO || 'GD-2026-10-0007';
const ROW = Number(process.env.ROW || 1127);           // 完工那一行(仅用于追溯段对照)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: process.env.MES_USER || 'admin', password: process.env.MES_PASS || '123456' }),
})).json();
const token = login?.data?.token;
if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 200));
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = async (p, b) => {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
  const j = await r.json();
  return { code: j.code, data: j.data, msg: j.message };
};
const rowsOf = (d) => (Array.isArray(d) ? d : (d?.明细 || []));
let fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) fail++;
};

const und = await post('/api/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '未完工' });
const done = await post('/api/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '已完工' });
const all = await post('/api/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '全部' });
const ls = await post('/api/px/scheduleBoard/linesSummary', {});
const st = await post('/api/px/scheduleBoard/stats', {});
const lsRows = rowsOf(ls.data);
const lineOf = (l) => (lsRows.find((r) => r.生产线 === l) || {})['未交量'];
const loadOf = (l) => ((st.data?.['产线'] || []).find((x) => x.生产线 === l) || {})['今日负荷'];
const fmt = (l) => rowsOf(l).map((r) => `${r['加工单号']}#${r['工单行号']}(${r['生产状态']})`).join(' | ') || '(空)';

console.log(`组装线「${LINE}」`);
check(rowsOf(und.data).every((r) => r['生产状态'] !== '完工'), '未完工页签里没有完工行', fmt(und.data));
check(rowsOf(done.data).some((r) => r['生产状态'] === '完工'), '已完工页签能列出完工行(修前恒空)', fmt(done.data));
check(all.code === 200 && rowsOf(all.data).length >= rowsOf(und.data).length, '全部页签不受影响', fmt(all.data));
check(Number(lineOf(LINE)) === 0, `该线未交量已剔除完工行 = ${lineOf(LINE)}`);
check(Number(loadOf(LINE)) === 0, `该线今日负荷已剔除完工行 = ${loadOf(LINE)}`);

console.log(`\n同单未完工行所在线「${OTHER}」(按行判,不误伤)`);
const other = rowsOf((await post('/api/px/scheduleBoard/scheduled', { 生产线: OTHER, scope: '未完工' })).data);
check(other.length > 0, '未完工行照旧在本线', fmt(other));
check(Number(lineOf(OTHER)) > 0, `该线未交量仍计入未完工行 = ${lineOf(OTHER)}`);

console.log('\n不该被剔除的入口');
const wo = await post('/api/px/workOrderList', {});
check((wo.data || []).some((r) => r['生产状态'] === '完工'), '生产工单列表仍显示完工单', (wo.data || []).map((r) => `${r['工单号']}#${r['工单行号']}(${r['生产状态']})`).join(' | '));
const tr = await post('/api/px/scheduleBoard/trace', { 工单号: WO, 工单行id: ROW });
check(tr.code === 200 && (tr.data?.['排产数据'] || []).length > 0, '追溯仍是完整记录', `排产数据 ${(tr.data?.['排产数据'] || []).length} 行 / 完工数据 ${(tr.data?.['完工数据'] || []).length} 行`);

console.log(fail ? `\n[FAIL] ${fail} 项不满足` : '\n[PASS] 完工行已不在组装(末道)工序里,其余入口未受影响');
if (fail) process.exitCode = 1;
