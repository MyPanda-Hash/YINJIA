// 回滚工具:从安全规范的备份文件(backup/*.jsonl)还原单据前像
// 用法:
//   node _rollback.mjs backup/SO_ORDER-2026-09-11-09-40-00.jsonl            先预演(只统计,不改库)
//   node _rollback.mjs backup/SO_ORDER-....jsonl --apply                    实际回滚(超阈值需确认)
//   node _rollback.mjs backup/SO_ORDER-....jsonl --apply --yes              跳过确认
// 行为:对备份中出现的每个单据编号,先删除本地现有头/行,再按备份内容原样插入(含审计列)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeLogger, confirmBatch } from './safety.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const YES = args.includes('--yes');
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(readText(join(HERE, 'config.json')));
const s = cfg.sync || {};
const { log } = makeLogger({ baseDir: HERE, retentionDays: s.logRetentionDays || 365, prefix: 'rollback' });

if (!file || !existsSync(file)) {
  console.error(`✗ 用法:node _rollback.mjs <backup/xxx.jsonl> [--apply] [--yes]\n  可用备份:${join(HERE, 'backup')}`);
  process.exit(1);
}
const isSo = /SO_ORDER/.test(file);
const headTable = isSo ? 'bd_so_order' : 'bd_pu_order';
const lineTable = isSo ? 'bl_so_order' : 'bl_pu_order';
const panel = isSo ? 'SO_ORDER' : 'PU_ORDER';

const heads = [], lines = [];
for (const ln of readText(file).split('\n')) {
  if (!ln.trim()) continue;
  const o = JSON.parse(ln);
  if (o.t === 'head') heads.push(o); else lines.push(o);
}
const docNos = [...new Set(heads.map((h) => h.单据编号))];
log(`备份文件:${file}`);
log(`解析:头 ${heads.length} 条 / 行 ${lines.length} 条,涉及单据 ${docNos.length} 张,目标表 ${headTable}/${lineTable}`);
if (!APPLY) { log('预演模式(未改库):加 --apply 执行回滚'); process.exit(0); }

const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

const ok = await confirmBatch({
  log, label: '【回滚】', planned: heads.length + lines.length,
  threshold: s.confirmThreshold === undefined ? 200 : s.confirmThreshold, assumeYes: YES,
});
if (!ok) { log('已中止回滚'); await pool.close(); process.exit(0); }

function inferType(mssql, v) {
  if (typeof v === 'number') return mssql.Decimal(18, 4);
  return mssql.NVarChar(1000);
}
async function insertRow(tx, table, row) {
  const req = new mssql.Request(tx);
  const cols = Object.keys(row).filter((k) => k !== 't' && k !== 'id'); // id 为自增列,不还原
  const ph = cols.map((c, i) => { req.input(`r${i}`, inferType(mssql, row[c]), row[c]); return `@r${i}`; });
  await req.query(`INSERT INTO ${table} (${cols.map((c) => `[${c}]`).join(',')}) VALUES (${ph.join(',')})`);
}

// 单事务:删现有 → 原样插回(任一步失败整体回滚,不会留下半成品)
const tx = new mssql.Transaction(pool);
await tx.begin();
try {
  for (let i = 0; i < docNos.length; i += 300) {
    const c = docNos.slice(i, i + 300);
    const req = new mssql.Request(tx);
    c.forEach((v, j) => req.input(`d${j}`, mssql.NVarChar(200), v));
    const inClause = c.map((_, j) => `@d${j}`).join(',');
    await req.query(`DELETE FROM ${lineTable} WHERE 单据编号 IN (${inClause})`);
    await req.query(`DELETE FROM ${headTable} WHERE 单据编号 IN (${inClause})`);
  }
  for (const h of heads) await insertRow(tx, headTable, h);
  for (const l of lines) await insertRow(tx, lineTable, l);
  await tx.commit();
  log(`回滚完成:还原头 ${heads.length} 条 / 行 ${lines.length} 条`);
} catch (e) {
  await tx.rollback();
  log(`✗ 回滚失败(已整体回滚,数据库未变更):${e.message}`);
  process.exitCode = 1;
}
await pool.close();
