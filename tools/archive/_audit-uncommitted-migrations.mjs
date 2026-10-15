/**
 * _audit-uncommitted-migrations.mjs — 未提交迁移脚本的**应用状态审计**(只读,2026-10-16)
 *
 * 对每个「工作区里未提交的新迁移脚本」回答三件事:
 *   ① 是否已登记进 tools/db-migrations.txt(清单唯一权威,未登记=不会被任何环境执行);
 *   ② 在 HSDZ_MES(正式) 的 yj_schema_log 里有没有记录、记录的内容哈希与当前文件**是否一致**
 *      (不一致 = DbSync 下次会「重跑」它,见 AGENTS「迁移链卫生」);
 *   ③ 同上,对 HSDZ_MES_TEST(测试账套)。
 * 哈希算法与 DbSync.sha256 一致:文件原始字节的 SHA-256(不改行尾、不转码)。
 *
 * 用法(仓库根目录):node tools/archive/_audit-uncommitted-migrations.mjs [脚本名...]
 *   不给参数 = 自动取 `git status` 里未跟踪的 tools/migrate-*.sql。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const manifest = readFileSync(join(ROOT, 'tools', 'db-migrations.txt'), 'utf8');
let scripts = process.argv.slice(2);
if (!scripts.length) {
  scripts = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((l) => l.startsWith('??') && /tools[\\/]migrate-.*\.sql$/.test(l))
    .map((l) => basename(l.slice(3).trim()));
}
console.log(`待审脚本 ${scripts.length} 个\n`);

async function dbState(dbName) {
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: dbName,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const r = await pool.request().query('SELECT script_name, content_hash, applied_at FROM dbo.yj_schema_log');
  await pool.close();
  return new Map(r.recordset.map((x) => [x.script_name, x]));
}

const [main, test] = [await dbState('HSDZ_MES'), await dbState('HSDZ_MES_TEST')];
const rows = [];
for (const s of scripts) {
  const path = join(ROOT, 'tools', s);
  let hash = '';
  try { hash = createHash('sha256').update(readFileSync(path)).digest('hex'); } catch { hash = '(文件缺失)'; }
  const inManifest = manifest.includes(s);
  const m = main.get(s), t = test.get(s);
  const verdict = (x) => (!x ? '未执行' : x.content_hash.trim() === hash ? '已执行·哈希一致' : '已执行·**哈希不同(会被重跑)**');
  rows.push({
    脚本: s.replace(/^migrate-/, ''), 已登记: inManifest ? '是' : '❌否', 正式库: verdict(m), 测试库: verdict(t),
  });
}
console.table(rows);

const missing = rows.filter((r) => r.已登记 !== '是').map((r) => r.脚本);
const drift = rows.filter((r) => r.正式库.includes('哈希不同') || r.测试库.includes('哈希不同')).map((r) => r.脚本);
const notApplied = rows.filter((r) => r.正式库 === '未执行' || r.测试库 === '未执行').map((r) => r.脚本);
console.log('\n未登记进清单:', missing.length ? missing.join(', ') : '无');
console.log('哈希漂移(会被重跑):', drift.length ? drift.join(', ') : '无');
console.log('尚未在某个账套执行:', notApplied.length ? notApplied.join(', ') : '无');
