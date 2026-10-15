/**
 * _q-rerun-set-20261017.mjs — 列出「会被 DbSync 重跑」的脚本(工作区内容哈希 ≠ 账套登记哈希)。
 *
 * 背景:合并把一批迁移脚本换成了新内容(两账套登记里还是旧哈希)⇒ DbSync 判「变更,重新执行」,
 * 而这些脚本的自检是按**当时**的对象写的(表后来被下架/字段被删)⇒ 重跑即 FAIL ⇒ 链断。
 * 本探针只读,用来一次性看清全部待重跑脚本,别一个个撞。
 *
 * 用法:node tools/archive/_q-rerun-set-20261017.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');

const readLog = async (db) => {
  const pool = await new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: db,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  }).connect();
  try {
    const r = await pool.request().query('SELECT script_name, content_hash FROM yj_schema_log');
    return new Map(r.recordset.map((x) => [String(x.script_name).trim(), String(x.content_hash).trim()]));
  } finally { await pool.close(); }
};

const [prod, test] = await Promise.all([readLog('HSDZ_MES'), readLog('HSDZ_MES_TEST')]);
const manifest = readFileSync(join(ROOT, 'tools', 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

const hashOf = (rel) => {
  try { return createHash('sha256').update(readFileSync(join(ROOT, 'tools', rel))).digest('hex'); }
  catch { return null; }
};

const rerunProd = [], rerunTest = [], missingFile = [];
for (const rel of manifest) {
  const h = hashOf(rel);
  if (!h) { missingFile.push(rel); continue; }
  if (prod.get(rel) !== h) rerunProd.push(rel);
  if (test.get(rel) !== h) rerunTest.push(rel);
}
console.log(`清单 ${manifest.length} 条`);
console.log(`\n=== 正式会被重跑 ${rerunProd.length} 条 ===`);
for (const r of rerunProd) console.log(`  ${prod.has(r) ? '[变更]' : '[新增]'} ${r}`);
console.log(`\n=== 测试会被重跑 ${rerunTest.length} 条 ===`);
for (const r of rerunTest) console.log(`  ${test.has(r) ? '[变更]' : '[新增]'} ${r}`);
if (missingFile.length) { console.log(`\n=== 清单指向缺失文件 ${missingFile.length} 条 ===`); for (const m of missingFile) console.log(`  ${m}`); }
