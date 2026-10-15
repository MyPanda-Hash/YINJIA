/**
 * _probe-schedule-plsl-20261017.mjs — 「排产后 plang_pc.pl_sl 有没有量」的现役实例实测(测试账套)。
 *
 * 背景:2026-10-15 修过「排产后 pl_sl 全 0」(fc808eea:WorkOrderScheduleRecord 集中建/同步原有字段),
 * 但当时 8090 没重启 ⇒ 内存里仍是旧代码。2026-10-17 已受控重启,本探针就是来验它真生效。
 *
 * 只读视图:先看 pending 池形状;加 --assign 才真的排一行(TEST 账套,排一条真实行)。
 * 用法:node tools/archive/_probe-schedule-plsl-20261017.mjs [--assign]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090';
const DO_ASSIGN = process.argv.includes('--assign');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json());
if (!login?.data?.token) { console.log('[FAIL] 测试账套登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1); }
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
console.log(`[OK] 登录测试账套(YJ_TEST)`);

const post = async (path, body) => {
  const r = await fetch(`${BASE}/api${path}`, { method: 'POST', headers: H, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
};

const pool = await post('/px/scheduleBoard/pending', {});
console.log(`pending HTTP ${pool.status}, 行数 ${Array.isArray(pool.j.data) ? pool.j.data.length : 'n/a'}`);
const rows = Array.isArray(pool.j.data) ? pool.j.data : [];
if (rows.length) {
  console.log('池内首行字段:', Object.keys(rows[0]).join(', '));
  console.log('前 5 行:', rows.slice(0, 5).map((r) => `${r['加工单号']}#${r['行id'] ?? r['工单行号']} 需求=${r['需求数量']} 排产=${r['排产数量']} 线=${r['生产线'] ?? ''}`).join(' | '));
}

if (DO_ASSIGN) {
  const stats = await post('/px/scheduleBoard/stats', {});
  const sd = stats.j?.data || {};
  console.log('\nstats 顶层键:', Object.keys(sd).join(', '));
  const lines = sd['产线'] || sd.lines || sd['生产线'] || [];
  const lineName = (l) => (typeof l === 'string' ? l : String(l?.['产线'] ?? l?.name ?? l?.['生产线'] ?? l?.['产线名称'] ?? ''));
  console.log(`产线下拉 ${Array.isArray(lines) ? lines.length : 0} 条:`, (Array.isArray(lines) ? lines.slice(0, 4).map(lineName) : []).join(' | '));
  const cand = rows.find((r) => Number(r['需求数量']) > 0 && !String(r['生产线'] ?? '').trim());
  if (!cand) { console.log('[跳过] 池内没有「已审核·未指派产线」的行,不造数'); }
  else {
    const want = Number(cand['需求数量']);
    const line = Array.isArray(lines) && lines.length ? lineName(lines[0]) : '';
    console.log(`\n=== 排产:${cand['加工单号']}#${cand['行id'] ?? cand['工单行号']} 数量=${want}(=需求) 产线=${line} ===`);
    const res = await post('/px/scheduleBoard/assign', {
      rows: [{ 加工单号: cand['加工单号'], 行id: cand['行id'], 生产线: line, 排产数量: want }],
    });
    console.log(`assign HTTP ${res.status}:`, JSON.stringify(res.j).slice(0, 500));
  }
}

// 落库复核
const pool2 = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port || 1433, database: 'HSDZ_MES_TEST',
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
try {
  const q = async (sql) => (await pool2.request().query(sql)).recordset;
  console.log('\n=== HSDZ_MES_TEST:plang 与 plang_pc 的数量列 ===');
  for (const r of await q(`SELECT TOP 6 id, pl_no, xq_sl, pl_sl, yl, scx, ja FROM plang ORDER BY id DESC`)) {
    console.log(`  plang ${r.id} ${r.pl_no} 需求=${r.xq_sl} 排产=${r.pl_sl} 余量=${r.yl} 线=${r.scx ?? '-'} 结案=${r.ja}`);
  }
  for (const r of await q(`SELECT TOP 6 id, plang_id, pl_sl, yl, scx, asp_cancel FROM plang_pc ORDER BY id DESC`)) {
    console.log(`  plang_pc ${r.id} plang_id=${r.plang_id} pl_sl=${r.pl_sl} yl=${r.yl} 线=${r.scx ?? '-'} cancel=${r.asp_cancel ?? '-'}`);
  }
  const zero = await q(`SELECT COUNT(*) AS n FROM plang_pc WHERE ISNULL(pl_sl,0) <= 0 AND ISNULL(asp_cancel,'N') <> 'Y'`);
  console.log(`  ⚠ 有效排产记录里 pl_sl <= 0 的条数:${zero[0].n}(修复后应为 0)`);
} finally { await pool2.close(); }
