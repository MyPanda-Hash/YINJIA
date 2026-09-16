// 一次性切换脚本:正式账套/更换账套前的数据库准备
// ① 补迁移列(幂等,总是执行)
// ② 清空旧同步数据(**仅当显式传 --clean 时执行;遵循安全规范:统计+提示+先备份**)
// 用法:
//   node _switch-prod.mjs                仅迁移(安全)
//   node _switch-prod.mjs --clean        迁移 + 清空已同步数据(--clean 后仍会提示确认)
//   node _switch-prod.mjs --clean --yes  跳过确认(无人值守)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeLogger, confirmBatch, backupBeforeWrite } from './safety.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const YES = args.includes('--yes');
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(readText(join(HERE, 'config.json')));
const s = cfg.sync || {};
const { log } = makeLogger({ baseDir: HERE, retentionDays: s.logRetentionDays || 365 });

const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

// ① 迁移(按 GO 分批执行,幂等)
const batches = readText(join(HERE, 'migrate-add-external-cols.sql'))
  .split(/^\s*GO\s*$/im).map((t) => t.trim()).filter(Boolean);
for (const b of batches) await new mssql.Request(pool).batch(b);
const chk = (await new mssql.Request(pool).query(batches[batches.length - 1])).recordsets[0];
log('迁移自检:');
for (const x of chk) log(`  ${x['项']} => ${x['已就绪'] === 1 ? '✓' : '✗'}`);

// ② 清空旧同步数据(显式 --clean;规范:统计→提示→备份→删除)
if (!CLEAN) {
  log('未传 --clean,跳过数据清理(仅迁移)');
} else {
  const pairs = [
    { head: 'bd_so_order', line: 'bl_so_order', panel: 'SO_ORDER', label: '销售订单' },
    { head: 'bd_pu_order', line: 'bl_pu_order', panel: 'PU_ORDER', label: '采购订单' },
  ];
  let total = 0;
  const plan = [];
  for (const p of pairs) {
    const n = (await new mssql.Request(pool).query(
      `SELECT COUNT(*) AS n FROM ${p.head} WHERE 外部数据ID IS NOT NULL`)).recordset[0].n;
    total += n;
    plan.push({ ...p, n });
  }
  log(`待清理:${plan.map((p) => `${p.label} ${p.n} 条`).join(',')}(合计 ${total} 条)`);
  const ok = await confirmBatch({
    log, label: '【清理已同步数据】', planned: total,
    threshold: s.confirmThreshold === undefined ? 200 : s.confirmThreshold, assumeYes: YES,
  });
  if (!ok) {
    log('已中止清理,未删除任何数据');
  } else {
    for (const p of plan) {
      if (!p.n) continue;
      await backupBeforeWrite({
        mssql, pool, baseDir: HERE, panel: p.panel,
        headTable: p.head, lineTable: p.line, docNos: null,
        retentionDays: s.backupRetentionDays || 365, log,
      });
      await new mssql.Request(pool).batch(`
        DELETE FROM ${p.line} WHERE 单据编号 IN (SELECT 单据编号 FROM ${p.head} WHERE 外部数据ID IS NOT NULL);
        DELETE FROM yj_doc_status WHERE panel_code = N'${p.panel}' AND doc_no IN (SELECT 单据编号 FROM ${p.head} WHERE 外部数据ID IS NOT NULL);
        DELETE FROM ${p.head} WHERE 外部数据ID IS NOT NULL;`);
      log(`已清理【${p.label}】${p.n} 条(前像已备份,可回滚)`);
    }
  }
}
await pool.close();
