/**
 * _e2e-plan-qty.mjs — 「排产数量」端到端验证(2026-10-16 用户口径「实现排产数」的任务产物)。
 *
 * 验的是**真接口 + 真库**(不是 mock):① 部分排产(排产数量 < 需求数量)② 已排产改排产数量
 * ③ 超需求被拦;并在**测试账套 HSDZ_MES_TEST** 上把过程列印出来,收尾逐列还原。
 *
 * ⚠ 纪律:本脚本**只对测试账套写**(登录带 factory=YJ_TEST);正式库(HSDZ_MES)一律不跑写测试。
 * ⚠ 目标行必须**干净**(无 plang_pc 排产行、无 wo_process_line 台账行),否则还原不精确 —— 脚本会自检并拒绝。
 *
 * 用法(仓库根;8090 需在跑且已部署含本功能的包):
 *   node tools/archive/_plan-qty-e2e/_e2e-plan-qty.mjs
 *   WO_NO=GD-2026-10-0001 WO_ROW=61 QTY1=2000 QTY2=2500 node tools/archive/_plan-qty-e2e/_e2e-plan-qty.mjs
 *
 * 断言口径(与后端同源):
 *   · plang.pl_sl = 本次排产数量,plang.yl = 需求 − 排产;
 *   · plang_pc(排产记录)镜像同步 pl_sl —— 追溯「排产数据」段/看板未交量读的就是它;
 *   · wo_process_line.计划数量 = 本次排产数量 × **该工序自己的**换算率(各道分开算,不累乘);
 *   · 排产数量 > 需求数量 ⇒ 拒绝(409),数量不变;
 *   · 改数量留痕 yj_usage_log「改排产数量」。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');       // tools/archive/_xxxx → 仓库根
const DEPLOY = join(REPO, 'deploy');
const cfg = JSON.parse(readFileSync(join(DEPLOY, 'config.json'), 'utf8'));
const req = createRequire(join(DEPLOY, 'package.json'));
const mssql = req('mssql');
const BASE = (process.env.MES_BASE || 'http://127.0.0.1:8090').replace(/\/$/, '');
const NO = process.env.WO_NO || 'GD-2026-10-0001';
const ROW = Number(process.env.WO_ROW || 61);
const QTY1 = Number(process.env.QTY1 || 2000);      // 部分排产(必须 < 该行需求数量)
const QTY2 = Number(process.env.QTY2 || 2500);      // 已排产改数量(同样 < 需求数量)

const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433, database: 'HSDZ_MES_TEST',
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();
async function q(sql, params = {}) {
  const r = pool.request();
  for (const [k, v] of Object.entries(params)) r.input(k, v);
  return (await r.query(sql)).recordset;
}

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: process.env.MES_USER || 'admin', password: process.env.MES_PASS || '123456', factory: 'YJ_TEST' }),
})).json();
const token = login?.data?.token;
if (!token) throw new Error('测试账套登录失败:' + JSON.stringify(login).slice(0, 200));
console.log(`登录 测试账套(YJ_TEST)OK;目标行 ${NO} 行id=${ROW}`);
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = async (p, body) => {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};

const COLS = ['scx', 'pl_man', 'lb', 'st_date', 'cp_date', 'pl_sl', 'yl', 'asp_user2', 'asp_time2'];
const maxLogId = (await q(`SELECT ISNULL(MAX(id),0) AS m FROM dbo.yj_usage_log`))[0].m;
const snap = (await q(`SELECT ${COLS.join(',')} FROM dbo.plang WHERE id=@id`, { id: ROW }))[0];
if (!snap) throw new Error('目标行不存在');
const pc0 = (await q(`SELECT COUNT(*) AS n FROM dbo.plang_pc WHERE plang_id=@id`, { id: ROW }))[0].n;
const ld0 = (await q(`SELECT COUNT(*) AS n FROM dbo.wo_process_line WHERE 工单行id=@id`, { id: ROW }))[0].n;
if (pc0 || ld0) throw new Error(`目标行已有 plang_pc=${pc0} / 台账=${ld0} 行,请换一行(否则还原不干净)`);
const head = (await q(`SELECT xq_sl, rk_sl FROM dbo.plang WHERE id=@id`, { id: ROW }))[0];
console.log(`运行前:排产=${snap.pl_sl} 需求=${head.xq_sl} 入库=${head.rk_sl} 产线=${snap.scx}`);

// 路线 + 候选线(照前端 optionsOf 口径:按工序车间过滤)
const route = ((await post('/api/px/scheduleBoard/routeSteps', { 加工单号: NO, 行id: ROW })).data || {})['工序步骤'] || [];
const lines = (((await post('/api/px/scheduleBoard/stats', {})).data) || {})['产线'] || [];
if (!route.length) throw new Error('该行没有工艺路线工序,换一行');
const steps = route.map((s) => {
  const shop = String(s['生产车间'] || '');
  const cand = lines.filter((l) => !shop || String(l['生产车间'] || '') === shop);
  return { 工序: s['工序'], 生产线: (cand[0] || lines[0])?.['生产线'] };
});
console.log('路线:', route.map((s) => `${s['工序']}(×${s['换算率']})`).join(' → '));

const show = async (tag) => {
  const p = (await q(`SELECT pl_sl, yl, scx FROM dbo.plang WHERE id=@id`, { id: ROW }))[0];
  const pc = (await q(`SELECT pl_sl FROM dbo.plang_pc WHERE plang_id=@id AND ISNULL(asp_cancel,'N')<>'Y'`, { id: ROW }))[0];
  const ld = await q(`SELECT 工序, 计划数量, 状态 FROM dbo.wo_process_line WHERE 工单行id=@id AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(工序序,999)`, { id: ROW });
  console.log(`  [${tag}] plang.排产=${p?.pl_sl} 余量=${p?.yl} 线=${p?.scx} | plang_pc.排产=${pc?.pl_sl ?? '(无行)'}`
    + ` | 台账=${ld.map((x) => `${x.工序}:${x['计划数量']}/${x['状态']}`).join(' ')}`);
};

console.log(`\n① 部分排产:排产数量 = ${QTY1}(需求 ${head.xq_sl})`);
const r1 = await post('/api/px/scheduleBoard/preplan', { 加工单号: NO, 行id: ROW, 排产数量: QTY1, 步骤: steps });
console.log('  接口:', r1.code, r1.message || '', JSON.stringify(r1.data || {}).slice(0, 140));
await show('排产后');

console.log(`\n② 已排产改排产数量 → ${QTY2}`);
const r2 = await post('/api/px/scheduleBoard/preplan', { 加工单号: NO, 行id: ROW, 排产数量: QTY2, 步骤: steps });
console.log('  接口:', r2.code, r2.message || '', JSON.stringify(r2.data || {}).slice(0, 140));
await show('改数量后');

console.log('\n③ 守卫:排产数量 99,999,999(超需求,应被拒)');
const r3 = await post('/api/px/scheduleBoard/preplan', { 加工单号: NO, 行id: ROW, 排产数量: 99999999, 步骤: steps });
console.log('  接口:', r3.code, String(r3.message).slice(0, 140));

console.log('\n④ 留痕:', JSON.stringify(await q(
  `SELECT TOP 3 action_name, doc_no, created_at FROM dbo.yj_usage_log WHERE doc_no=@no AND action_name IN (N'排产', N'改排产数量') ORDER BY id DESC`,
  { no: NO })));

// ── 还原(测试账套) ──
const restore = pool.request().input('id', ROW).input('scx', snap.scx);
for (const c of COLS.filter((x) => x !== 'scx')) restore.input(c, snap[c]);
await restore.query(`UPDATE dbo.plang SET ${COLS.filter((x) => x !== 'scx').map((x) => `[${x}]=@${x}`).join(',')},scx=@scx WHERE id=@id`);
await q(`DELETE FROM dbo.plang_pc WHERE plang_id=@id`, { id: ROW });
await q(`DELETE FROM dbo.wo_process_line WHERE 工单行id=@id`, { id: ROW });
await q(`DELETE FROM dbo.yj_usage_log WHERE id > @m AND action_name IN (N'排产', N'改排产数量')`, { m: maxLogId });
await show('还原后');
console.log('\n测试账套已还原(plang 各列回到运行前值,plang_pc / 台账 恢复为 0 行)。');
await pool.close();
