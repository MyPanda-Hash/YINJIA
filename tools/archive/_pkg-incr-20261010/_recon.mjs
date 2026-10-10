#!/usr/bin/env node
/**
 * _recon.mjs — 新部署包(pkg-incr-20261010)的打包前侦察(只读)
 *
 * 回答四件事:
 *   ① 清单 ↔ tools/*.sql 的一致性:哪些 .sql 在磁盘上却没登记(体检 12 项 FAIL 的 3 处)
 *   ② 自上个包的基准(57bc2914 = 服务器当前 jar 的构建来源)以来的清单增减
 *   ③ to-run 候选:新增的(强制跑) + 字节变更的(会被 DbSync 判重跑)
 *   ④ 与链外白名单比对,判断 ① 里哪些是"真缺漏"、哪些是"合法的链外工具"
 *
 * 用法(在 tools 目录下): node archive/_pkg-incr-20261010/_recon.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BASE = process.cwd();                       // tools
const ROOT = BASE.replace(/[\\/]tools$/, '');
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const parse = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter((x) => x && !x.startsWith('#'));

const MANIFEST = parse(readFileSync(`${BASE}/db-migrations.txt`, 'utf8'));
const onDisk = readdirSync(BASE).filter((f) => f.endsWith('.sql')).sort();
const listed = new Set(MANIFEST);

console.log('=== ① 清单 ↔ 文件 ===');
console.log(`  清单 ${MANIFEST.length} 条;tools/*.sql ${onDisk.length} 个`);
const unlisted = onDisk.filter((f) => !listed.has(f));
const dangling = MANIFEST.filter((f) => !existsSync(`${BASE}/${f}`));
console.log(`  磁盘有、清单无(${unlisted.length}):`);
unlisted.forEach((f) => console.log(`     ${f}`));
console.log(`  清单有、磁盘无(${dangling.length}): ${dangling.join(', ') || '(无)'}`);

// 链外白名单(DbNormAudit.check12 的内置名单 + `_` 前缀豁免)
const ALLOW = new Set(['check-migrations.sql', 'deploy-all.sql', 'dump-schema-log.sql', 'dump-server-views.sql',
  'fix-db-logins.sql', 'migrate-golive-cleanup.sql', 'migrate-rd-cleanup.sql', 'migrate-table-comments.sql',
  'migrate-testdata-cleanup.sql', 'restore-from-backup.sql', 'restore-local-bak.sql', 'seed-demo-prodfile.sql',
  'migrate-wo-process-line-drop.sql']);
const realGaps = unlisted.filter((f) => !f.startsWith('_') && !ALLOW.has(f));
console.log(`  ⇒ 真缺漏(非白名单、非 _ 前缀): ${realGaps.length} 个`);
realGaps.forEach((f) => console.log(`     ${f}`));

console.log('\n=== ② 清单增减(vs 上个包基准 57bc2914) ===');
const oldManifest = parse(git(['show', '57bc2914:tools/db-migrations.txt']));
const oldSet = new Set(oldManifest);
const added = MANIFEST.filter((f) => !oldSet.has(f));
const removed = oldManifest.filter((f) => !listed.has(f));
console.log(`  基准 ${oldManifest.length} 条 → 现在 ${MANIFEST.length} 条;新增 ${added.length};退场 ${removed.length}`);
console.log('  新增(强制跑):');
added.forEach((f, i) => console.log(`     ${String(i + 1).padStart(2)}. ${f}`));
console.log(`  退场: ${removed.join(', ') || '(无)'}`);

console.log('\n=== ③ 字节变更的既有脚本(会被 DbSync 判重跑) ===');
const changed = git(['diff', '--name-only', '--diff-filter=M', '57bc2914', 'HEAD', '--', 'tools/*.sql'])
  .split(/\r?\n/).filter((f) => f && /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, ''));
const stillListed = changed.filter((f) => listed.has(f));
console.log(`  改动过的 ${changed.length} 个,其中仍在清单里的 ${stillListed.length} 个:`);
stillListed.forEach((f) => {
  const h = createHash('sha256').update(readFileSync(`${BASE}/${f}`)).digest('hex').slice(0, 12);
  console.log(`     ${f}  (sha ${h}…)`);
});
const changedUnlisted = changed.filter((f) => !listed.has(f));
if (changedUnlisted.length) console.log(`  ⚠ 另有 ${changedUnlisted.length} 个改动过的脚本已不在清单(不再执行): ${changedUnlisted.slice(0, 5).join(', ')}${changedUnlisted.length > 5 ? ' …' : ''}`);

console.log('\n=== ④ to-run 建议清单(顺序 = 清单顺序) ===');
const toRunSet = new Set([...added, ...stillListed]);
const toRun = MANIFEST.filter((f) => toRunSet.has(f));
console.log(`  共 ${toRun.length} 条(新增 ${added.length} + 字节变更重跑 ${stillListed.length})`);
toRun.forEach((f, i) => console.log(`     ${String(i + 1).padStart(2)}. ${f}`));
