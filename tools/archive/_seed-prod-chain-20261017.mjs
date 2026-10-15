/**
 * _seed-prod-chain-20261017.mjs — 在**正式账套(HSDZ_MES)**造一份可走通的生产链测试数据。
 *
 * 用户口径(2026-10-17):「本地正式库造一份生产链测试数据(工单+排产+报工)」——
 * 目的:让「快速排产 / 工单排产(plang + plang_pc)」这两页真的有东西可排、可看;
 * 此前正式库只有 plang 3 行 / plang_pc 2 行。
 *
 * 全程走**app 自己的接口**(不直插,保证与状态机/占用链/号段一致):
 *   ① 工单   POST /px/orderConvert/toManu  —— SO 行 → plang(要求工艺路线**已审核**)
 *   ② 排产   POST /px/scheduleBoard/assign —— plang → plang_pc(这条正是刚验证修复的链路,pl_sl 必须落数)
 *   ③ 报工   POST /px/callButton(WO_REPORT) —— 建一张**草稿**报工单(不审核,避免触发完工/C 类联动)
 *
 * 造数标记:工单行走「已审核工艺路线 GY-2026-10-0003 / GY-CB-STD」+ 客户订单号为
 *   LZW-20261012-01 / ZL-20261012-01,清理见 tools/archive/_seed-prod-chain-cleanup-20261017.sql。
 *
 * 用法:node tools/archive/_seed-prod-chain-20261017.mjs [--dry]   (--dry 只打印计划不动库)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'http://127.0.0.1:8090';
const DRY = process.argv.includes('--dry');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');

// 造数计划:两条 SO 行 × 两条已审核工艺路线;排产数量**故意不同于需求**(好证明 pc 行落的是排产数量)
const PLAN = [
  { 订单号: 'LZW-20261012-01', 行id: '7451', 生单数量: 1000, 工艺路线: 'GY-2026-10-0003', 产线: '1号机', 排产数量: 600 },
  { 订单号: 'ZL-20261012-01', 行id: '7448', 生单数量: 5000, 工艺路线: 'GY-CB-STD', 产线: '2号机', 排产数量: 3000 },
];

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json());
if (!login?.data?.token) { console.log('[FAIL] 正式账套登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
const post = async (p, b) => {
  const r = await fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
console.log('[OK] 登录正式账套 YJ');
if (DRY) { console.log('(--dry 只打印计划,不写库)'); console.log(JSON.stringify(PLAN, null, 2)); process.exit(0); }

const db = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port || 1433, database: 'HSDZ_MES',
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
const q = async (sql) => (await db.request().query(sql)).recordset;
const before = await q(`SELECT COUNT(*) AS p FROM plang`);
const beforePc = await q(`SELECT COUNT(*) AS p FROM plang_pc`);
const beforeScjl = await q(`SELECT COUNT(*) AS p FROM scjl`);
console.log(`基线:plang ${before[0].p} / plang_pc ${beforePc[0].p} / scjl ${beforeScjl[0].p}`);

const created = [];
try {
  // ── ① 工单 ──
  const routes = (await post('/px/processTask/routes', {})).j?.data || [];
  const routeSteps = (code) => (routes.find((r) => String(r['编码']) === code)?.['工序序列'] || '').split('→').filter(Boolean);
  console.log('\n=== ① 订单结转 → 工单(plang) ===');
  for (const p of PLAN) {
    const res = await post('/px/orderConvert/toManu', {
      rows: [{ 订单号: p.订单号, 行id: p.行id, 生单数量: p.生单数量, 工艺路线: p.工艺路线 }],
    });
    const no = res.j?.data?.['编号清单']?.[0] || '';
    const failed = res.j?.data?.['失败行'] || [];
    console.log(`  ${p.订单号}#${p.行id} → HTTP ${res.status} 单号=${no || '(无)'} 失败=${JSON.stringify(failed)}`);
    if (!no) continue;
    const row = (await q(`SELECT TOP 1 id, pl_no, pl_xc, xq_sl, pl_sl, scx, [工艺路线] AS rt FROM plang WHERE pl_no='${no}' ORDER BY id DESC`))[0];
    created.push({ ...p, 工单号: no, 行id_plang: row?.id, 工序序列: routeSteps(p.工艺路线) });
    console.log(`     落库:plang id=${row?.id} 行号=${row?.pl_xc} 需求=${row?.xq_sl} 排产=${row?.pl_sl} 线=${row?.scx ?? '(空)'} 路线=${row?.rt}`);
  }

  // ── ② 排产 ──
  console.log('\n=== ② 排产 → plang_pc(验 pl_sl 落数) ===');
  for (const c of created) {
    const res = await post('/px/scheduleBoard/assign', {
      rows: [{ 加工单号: c.工单号, 行id: c.行id_plang, 生产线: c.产线, 排产数量: c.排产数量 }],
    });
    const pc = (await q(`SELECT TOP 1 id, plang_id, pl_sl, yl, scx FROM plang_pc WHERE plang_id=${c.行id_plang} ORDER BY id DESC`))[0];
    c.排产id = pc?.id;
    console.log(`  ${c.工单号}(plan ${c.行id_plang}) 排 ${c.产线} × ${c.排产数量} → HTTP ${res.status}`);
    console.log(`     plang_pc id=${pc?.id} pl_sl=${pc?.pl_sl} yl=${pc?.yl} 线=${pc?.scx} ${pc && Number(pc.pl_sl) === c.排产数量 ? '✅ 数量正确' : '❌ 数量不符'}`);
  }

  // ── ③ 报工(草稿) ──
  console.log('\n=== ③ 报工 → scjl(草稿,不审核) ===');
  for (const c of created) {
    const gx = (c.工序序列 || [])[0] || '成型';
    const res = await post('/px/callButton', {
      panelCode: 'WO_REPORT',
      buttonName: '保存为草稿',
      formData: {
        单据日期: new Date().toISOString().slice(0, 10),
        工单号: c.工单号,
        工单行号: String(c.行id_plang),
        工序: gx,
        报工数量: c.排产数量,
        生产线: c.产线,
        报工人: 'admin',
        备注: '造数(YJ-20261017 生产链测试数据)',
      },
    });
    const no = res.j?.data?.['单据编号'] || res.j?.data?.['docNo'] || '';
    console.log(`  ${c.工单号} 工序=${gx} → HTTP ${res.status} 报工单号=${no || JSON.stringify(res.j).slice(0, 160)}`);
    if (no) {
      const sr = (await q(`SELECT TOP 1 id, sc_no, gd_id, gxdm, sl, wgzt FROM scjl WHERE sc_no='${no}'`))[0];
      console.log(`     scjl id=${sr?.id} 单号=${sr?.sc_no} gd_id=${sr?.gd_id} 工序=${sr?.gxdm} 数量=${sr?.sl} 完工状态=${sr?.wgzt ?? '(空=草稿)'}`);
    }
  }

  const after = await q(`SELECT COUNT(*) AS p FROM plang`);
  const afterPc = await q(`SELECT COUNT(*) AS p FROM plang_pc`);
  const afterScjl = await q(`SELECT COUNT(*) AS p FROM scjl`);
  console.log(`\n结果:plang ${before[0].p}→${after[0].p} / plang_pc ${beforePc[0].p}→${afterPc[0].p} / scjl ${beforeScjl[0].p}→${afterScjl[0].p}`);
  writeFileSync(join(ROOT, 'tools', 'archive', '_seed-prod-chain-created-20261017.json'), JSON.stringify(created, null, 2), 'utf8');
  console.log('造数清单已写 tools/archive/_seed-prod-chain-created-20261017.json');
} finally { await db.close(); }
