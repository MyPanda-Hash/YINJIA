/**
 * _q-trace-api.mjs — 「工单详情 · 追溯」链路的取证探针(2026-10-16 事故产物)。
 *
 * 背景:追溯弹窗的内容全部来自 `/px/scheduleBoard/trace`(头/时间线/调拨/排产/完工/入库/质检/
 * 领料/血缘),**只有「工序进度」来自另一个接口** `/px/processTask/detail`。
 * 所以 trace 一 500,用户看到的就是「只剩工序进度、其余整片空白」= 报「丢失了部分实现」。
 * 本脚本把两个接口的回执按段打印出来,一眼看出「哪一段没了」还是「整个接口挂了」。
 *
 * 用法(仓库根):
 *   node tools/archive/_wo-trace-500-20261016/_q-trace-api.mjs [http://127.0.0.1:8090] [工单号] [工单行id]
 * 不给工单号时:自动取 HSDZ_MES.plang 里未作废的工单行(最多 2 行)逐行验。
 * 需要 deploy/config.json 里的库连接(读 plang 用)与 admin/123456(可改环境变量 MES_USER/MES_PASS)。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');   // tools/archive/_xxxx → 仓库根
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '');
const argWo = process.argv.find((a) => /^(GD|MO)-/.test(a));
const argLine = process.argv.find((a) => /^\d+$/.test(a));

async function login() {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: process.env.MES_USER || 'admin', password: process.env.MES_PASS || '123456' }),
  })).json();
  if (!r?.data?.token) throw new Error(`登录失败: ${JSON.stringify(r).slice(0, 200)}`);
  return r.data.token;
}

/** 取待验工单行:命令行给了就用,否则读 plang 未作废行(最多 2 行) */
async function targets() {
  if (argWo) return [{ pl_no: argWo, id: argLine ? Number(argLine) : null, pl_xc: null }];
  const cfg = JSON.parse(readFileSync(join(REPO, 'deploy', 'config.json'), 'utf8'));
  const req = createRequire(join(REPO, 'deploy', 'package.json'));
  const mssql = req('mssql');
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433,
    database: process.env.YINJIA_SQL_DB || cfg.database.database,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const rs = (await pool.request().query(
    `SELECT TOP 2 id, pl_no, pl_xc FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY pl_date DESC`)).recordset;
  await pool.close();
  if (!rs.length) throw new Error('plang 里没有未作废工单行,请显式传 工单号/工单行id');
  return rs;
}

const token = await login();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

for (const t of await targets()) {
  const body = { 工单号: t.pl_no, 工单行id: t.id ?? undefined };
  const res = await (await fetch(`${BASE}/api/px/scheduleBoard/trace`, {
    method: 'POST', headers: H, body: JSON.stringify(body),
  })).json();
  console.log(`\n=== trace ${t.pl_no}${t.pl_xc != null ? ' 行' + t.pl_xc : ''} 行id=${t.id} === code=${res?.code}`);
  if (res?.code !== 200) {
    console.log(`  ❌ ${String(res?.message).slice(0, 300)}`);
    if (/Invalid object name/i.test(String(res?.message))) {
      console.log('  ⇒ 典型的「旧 jar 查已删表」:用 _JarClassScan.java 扫一下现役 jar,并按 README.md 停→重打包→起');
    }
  } else {
    const d = res.data || {};
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) console.log(`  ${k}: ${v.length} 行`);
      else if (v && typeof v === 'object') console.log(`  ${k}: ${JSON.stringify(v)}`);
      else if (k !== '口径说明') console.log(`  ${k}: ${v}`);
    }
    const seg = d['分段口径'] || {};
    console.log(`  分段口径: ${Object.entries(seg).map(([a, b]) => `${a}=${b}`).join(' ')}`);
  }
  const p = await (await fetch(`${BASE}/api/px/processTask/detail`, {
    method: 'POST', headers: H, body: JSON.stringify(body),
  })).json();
  const steps = p?.data?.['工序步骤'] || [];
  console.log(`  -- processTask/detail code=${p?.code} 工序步骤=${steps.length} 步`
    + (steps.length ? ` (${steps.map((s) => `${s['工序']} ${s['完工量']}/${s['计划量']}${s['状态']}`).join(' | ')})` : ''));
}
