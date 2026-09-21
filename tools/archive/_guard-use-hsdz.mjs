// _guard-use-hsdz.mjs — 把迁移脚本里无条件的 `USE HSDZ_MES;` 收敛成「只在未选定库时才切」的守卫形式。
//
// 为什么必须改(DbSync.java 的既有承诺被打穿):
//   DbSync 支持 YINJIA_SQL_DB=HSDZ_MES_TEST 给测试账套补迁移,注释明写「不碰生产库」(DbSync.java:33-36)。
//   但 98/238 个脚本第一句是 `USE HSDZ_MES;` —— 实测(连 HSDZ_MES_TEST 执行 `USE HSDZ_MES` 后
//   DB_NAME() 变成 HSDZ_MES):这些脚本会把会话切回正式库,于是"给测试库补迁移"实际是**再改一遍生产库**,
//   而测试库一条也没补 —— 静默失败,无任何报错。
//
// 为什么不能直接删掉 `USE HSDZ_MES;`:
//   yinjia 登录的默认库是 master(实测 sys.server_principals.default_database_name)。
//   在 SSMS/sqlcmd 里不指定库直接跑脚本时,删掉 USE 会让 CREATE TABLE 之类语句落到 master。
//
// 采用的形态(已实测两种连接目标):
//   IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库
//     · 连 HSDZ_MES_TEST → 保持 HSDZ_MES_TEST(测试账套补迁移从此真的生效)
//     · 连 master        → 切到 HSDZ_MES(保留"不指定库直接跑"的便利)
//     · 连克隆库演练      → 保持克隆库(DbSync 注释里的演练用途也不被打穿)
//
// 用法:node tools/archive/_guard-use-hsdz.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const DRY = process.argv.includes('--dry');
const TOOLS = path.join(repo, 'tools');

const lines = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8').split('\n');
const entries = lines
  .map((l) => l.trim())
  .filter((t) => t && !t.startsWith('#'));

const USE_RE = /^(\s*)USE\s+HSDZ_MES\s*;?\s*(\r?)$/i;
const GUARDED = /IF\s+DB_NAME\(\)\s*=\s*N'master'\s+USE\s+HSDZ_MES/i;

const changed = [];
const already = [];
const missing = [];
const skipped = [];
const followStats = new Map();

const results = new Map();

for (const name of entries) {
  const abs = path.join(TOOLS, name);
  if (!fs.existsSync(abs)) { missing.push(name); continue; }
  const src = fs.readFileSync(abs, 'utf8');
  if (GUARDED.test(src)) { already.push(name); continue; }
  const srcLines = src.split('\n');
  const idx = srcLines.findIndex((l) => USE_RE.test(l));
  if (idx < 0) { skipped.push(name); continue; }

  // 看紧随其后的非空行:若同批次还有语句,需要确认 IF+USE 同批次语义(实测可行,但仍记录下来)
  let next = '';
  for (let i = idx + 1; i < srcLines.length; i++) {
    const t = srcLines[i].trim();
    if (!t) continue;
    next = t.toUpperCase() === 'GO' ? 'GO' : t.slice(0, 40);
    break;
  }
  followStats.set(next === 'GO' ? 'GO(独立批次)' : '同批次后续语句', (followStats.get(next === 'GO' ? 'GO(独立批次)' : '同批次后续语句') || 0) + 1);

  const indent = srcLines[idx].match(USE_RE)[1];
  const eol = srcLines[idx].endsWith('\r') ? '\r' : '';
  srcLines[idx] = `${indent}IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)${eol}`;
  results.set(name, srcLines.join('\n'));
  changed.push(name);
}

console.log(`清单条目 ${entries.length}  待改 ${changed.length}  已守卫 ${already.length}  无 USE 行 ${skipped.length}  文件缺失 ${missing.length}`);
console.log('\nUSE 行后面跟什么:');
for (const [k, v] of followStats) console.log(`  ${k}: ${v}`);

if (changed.length) {
  console.log(`\n待改文件(前 10):${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ' …' : ''}`);
}
if (missing.length) console.log(`\n⚠ 清单里文件不存在: ${missing.join(', ')}`);

// 校验:每个待改文件替换后行数不变、且恰好 1 处守卫、原 USE 行不再无条件存在
const problems = [];
for (const [name, out] of results) {
  const before = fs.readFileSync(path.join(TOOLS, name), 'utf8').split('\n');
  const after = out.split('\n');
  if (before.length !== after.length) problems.push(`${name} 行数变化 ${before.length}→${after.length}`);
  const guards = (out.match(/IF\s+DB_NAME\(\)\s*=\s*N'master'\s+USE\s+HSDZ_MES/gi) || []).length;
  if (guards !== 1) problems.push(`${name} 守卫数=${guards}`);
  const bare = after.filter((l) => USE_RE.test(l)).length;
  if (bare) problems.push(`${name} 仍有无条件 USE 行 ${bare} 条`);
}
if (problems.length) {
  console.log('\n校验未通过,未写盘:');
  for (const p of problems) console.log('  ! ' + p);
  process.exit(1);
}

if (!DRY) for (const [name, out] of results) fs.writeFileSync(path.join(TOOLS, name), out);
console.log(`\n校验通过(${results.size} 个文件行数不变、各 1 处守卫)${DRY ? ' —— dry-run,未写盘' : ',已落盘'}`);
