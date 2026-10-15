/**
 * _q-completion-done-time.mjs — 完工明细「完工时间 = 报工完成那一刻(本地墙钟)」回归探针(2026-10-16 任务产物)。
 *
 * 用户口径:「完工明细里的完工时间应该实现成能取**当时完成报工**完成时的时间」。
 * 根因:SQL Server(Docker 容器 TZ=UTC)的 GETDATE() 比北京时间慢 8 小时,完工时间被写成 8 小时前;
 * 修法:WoReportService.complete() 改用应用本地墙钟 LocalDateTime.now()(见类内注释)。
 *
 * 断言(默认在**测试账套 YJ_TEST** 上做,不碰正式库真实业务):
 *   ① 取一张已完工、且没有完工入库回写(入库单号为空,否则弃审会被守卫拒绝)的报工单;
 *   ② 弃审 → 完工明细里该单消失;
 *   ③ 重新审核 → 完工明细里该单回来,且「完工时间」≈ 本机当前时间(±120 秒);
 *   ④ 反向断言:完工时间**不是**本机时间 −8 小时(修前恒差 8 小时 = 本探针当初的红)。
 * 结束把该单恢复到已审核态(与进来时一致)。
 *
 * 用法(仓库根;8090 需在跑,且已装修改过的后端):
 *   node tools/archive/_wo-completion-wgsj/_q-completion-done-time.mjs
 *   FACTORY=YJ node ...            # 改在正式账套跑(谨慎:会弃审/重审一张真实报工单)
 *   NO=BG-2026-10-0177 node ...    # 指定报工单号
 */
const BASE = (process.env.BASE || 'http://127.0.0.1:8090').replace(/\/$/, '');
const FACTORY = process.env.FACTORY || 'YJ_TEST';
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userName: process.env.MES_USER || 'admin',
    password: process.env.MES_PASS || '123456',
    factory: FACTORY,
  }),
})).json();
const token = login?.data?.token;
if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 300));
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const call = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
  const j = await r.json();
  return { code: j.code, data: j.data, msg: j.message };
};
const list = async () => {
  const j = await call('/api/px/queryFormDataList', { panelCode: 'WO_COMPLETION_LIST', pageNo: 1, pageSize: 200 });
  if (j.code !== 0 && j.code !== 200) throw new Error('完工明细查询失败:' + JSON.stringify(j).slice(0, 200));
  return j.data?.list || [];
};
const local = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const secs = (a, b) => Math.abs((new Date(a.replace(' ', 'T')) - new Date(b.replace(' ', 'T'))) / 1000);
let fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) fail++;
};

const rows = await list();
console.log(`账套 ${FACTORY}:完工明细 ${rows.length} 行`);
// 候选:有报工单号(历史遗留行没有单号,应用改不动)、没有入库回写(有 post_no 弃审会被守卫挡)。
// 弃审还可能被"已生成检验单且已审核"挡住(成型/切炭/组装会出检验单)—— 逐个试,失败不落任何数据。
const cands = process.env.NO
  ? rows.filter((r) => r['报工单号'] === process.env.NO)
  : rows.filter((r) => String(r['报工单号'] || '').trim() && !String(r['入库单号'] || '').trim());
if (!cands.length) throw new Error('找不到可尝试的已完工报工单(需要 报工单号 非空、入库单号 为空)');

let no = '';
let un = null;
for (const c of cands) {
  const n = c['报工单号'];
  const r = await call('/api/px/callButton', { panelCode: 'WO_REPORT', buttonName: '弃审', formData: { 编号: n, 单据编号: n } });
  if (r.code === 0 || r.code === 200) { no = n; un = r; break; }
  console.log(`  · 跳过 ${n}:${r.msg || '弃审被拒'}`);
}
if (!no) throw new Error('所有候选都被守卫挡住,无法做端到端取证(可在界面先弃审下游检验单)');
const shot = cands.find((c) => c['报工单号'] === no);
console.log(`目标报工单 ${no}(工序 ${shot['工序']},原完工时间 ${shot['完工时间']})`);
check(true, `弃审 ${no}`, un.msg || '');
check(!(await list()).some((r) => r['报工单号'] === no), '弃审后该单已不在完工明细里');

const t0 = local();
const au = await call('/api/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审核', formData: { 编号: no, 单据编号: no } });
check(au.code === 0 || au.code === 200, `重新审核 ${no}`, au.msg || '');
const back = (await list()).find((r) => r['报工单号'] === no);
check(!!back, '审核后该单回到完工明细');
if (back) {
  const diff = secs(String(back['完工时间']), t0);
  check(diff <= 120, `完工时间 = 报工完成那一刻(本机 ${t0})`, `实际 ${back['完工时间']},差 ${Math.round(diff)}s`);
  const drift = (new Date(local().replace(' ', 'T')) - new Date(String(back['完工时间']).replace(' ', 'T'))) / 3600000;
  check(!(drift > 7 && drift < 9), '完工时间不是本机时间 −8 小时(GETDATE 旧口径)',
    `与本地时差 ${drift.toFixed(2)} 小时`);
}
console.log(fail ? `\n[FAIL] ${fail} 项不满足` : '\n[PASS] 完工明细的完工时间 = 报工完成那一刻的本地时间');
if (fail) process.exitCode = 1;
