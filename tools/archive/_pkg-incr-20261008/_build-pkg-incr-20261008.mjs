#!/usr/bin/env node
/**
 * _build-pkg-incr-20261008.mjs — 组装增量部署包 deploy/pkg-incr-20261008/
 *
 * 沿用 pkg-incr-20261007 的三件套咬合纪律(同 HEAD 的 jar + manifest + 全部清单内脚本):
 *   app.jar                  本 HEAD 由 mvn clean package 构建(A7 教训#2:结构级变更禁用热补丁 jar)
 *   tools/                   仅清单内脚本(429)+ DbSync.java + db-migrations.txt + lib/mssql-jdbc.jar
 *                            (链外脚本故意不入包 —— 与 10-07 包一致,避免把一次性清库脚本带到服务器)
 *   to-run-20261008.txt      强制清单:仅「A7 之后新增的脚本」,顺序 = 清单顺序
 *   deploy-incremental.bat   从仓库版生成,把 to-run 文件名与条数改写为本次
 *   apply-migrations.bat     同上(只跑迁移不动 jar)
 *   verify-package.ps1 / probe-login.ps1 / steps.md / SHA256SUMS.txt
 *
 * 用法: node tools/archive/_pkg-incr-20261008/_build-pkg-incr-20261008.mjs [--zip]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TOOLS = join(ROOT, 'tools');
const DEPLOY = join(ROOT, 'deploy');
const PKG = join(DEPLOY, 'pkg-incr-20261008');
const TAG = '20261008';
/** A7 部署落地时的 HEAD(见 deploy/部署说明.md §A7:jar=SHA dbe55fe7…,manifest 419 条) */
const A7_HEAD = 'b5ffe04e';
const ZIP = process.argv.includes('--zip');
/** steps.md 放在本工具目录下(可复现 —— 每次重建都会清空包目录,所以源放外面由脚本拷入) */
const STEPS_SRC = join(ROOT, 'tools', 'archive', '_pkg-incr-20261008', 'steps.md');

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const manifest = readFileSync(join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));
const HEAD = sh('git', ['rev-parse', '--short', 'HEAD']);

// A7 之后新增的脚本(以 git 的「新增」状态为准,不靠猜)
const addedSinceA7 = new Set(
  sh('git', ['diff', '--name-only', '--diff-filter=A', A7_HEAD, 'HEAD', '--', 'tools']).split(/\r?\n/)
    .filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, ''))
);
const removedSinceA7 = sh('git', ['diff', '--name-only', '--diff-filter=D', A7_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, ''));

const toRun = manifest.filter((s) => addedSinceA7.has(s));
if (toRun.length !== addedSinceA7.size) {
  const miss = [...addedSinceA7].filter((s) => !manifest.includes(s));
  throw new Error(`新增脚本里有 ${miss.length} 条不在清单里: ${miss.join(', ')}`);
}
console.log(`HEAD=${HEAD}  A7=${A7_HEAD}`);
console.log(`清单 ${manifest.length} 条;A7 后新增 ${addedSinceA7.size} 条(其中进 to-run ${toRun.length});退场 ${removedSinceA7.length} 条(${removedSinceA7.join(',') || '-'})`);

// ---------- 组装 ----------
if (existsSync(PKG)) rmSync(PKG, { recursive: true, force: true });
mkdirSync(join(PKG, 'tools', 'lib'), { recursive: true });

copyFileSync(join(DEPLOY, 'app.jar'), join(PKG, 'app.jar'));
for (const s of manifest) copyFileSync(join(TOOLS, s), join(PKG, 'tools', s));
for (const f of ['DbSync.java', 'db-migrations.txt']) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
copyFileSync(join(TOOLS, 'lib', 'mssql-jdbc.jar'), join(PKG, 'tools', 'lib', 'mssql-jdbc.jar'));
for (const f of ['verify-package.ps1', 'probe-login.ps1']) copyFileSync(join(DEPLOY, f), join(PKG, f));

// 回归闸与体检工具(2026-10-08 新增入包 —— 让服务器侧能自证,而不是只能靠开发机)
//   FourDocAudit:四单 yj_field 漂移闸(读同目录 fourdoc-baseline.tsv;有 archive/_dump-out 时另做物理列对账)
//   DbNormAudit :数据库规范 13 项体检(读同目录 db-legacy-whitelist.txt)
// 两者的数据文件都按 user.dir 解析 ⇒ 路径与「在 tools 目录下运行」的口径保持一致。
mkdirSync(join(PKG, 'tools', 'verify'), { recursive: true });
mkdirSync(join(PKG, 'tools', 'archive', '_dump-out'), { recursive: true });
mkdirSync(join(PKG, 'tools', 'archive', '_registry-audit-20261008'), { recursive: true });
for (const f of ['FourDocAudit.java', 'DbNormAudit.java']) copyFileSync(join(TOOLS, 'verify', f), join(PKG, 'tools', 'verify', f));
for (const f of ['fourdoc-baseline.tsv', 'db-legacy-whitelist.txt']) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
copyFileSync(join(TOOLS, 'archive', '_dump-out', '_head-fields-HSDZ_MES.md'),
             join(PKG, 'tools', 'archive', '_dump-out', '_head-fields-HSDZ_MES.md'));
// 一次性清理脚本(重跑 area-a-raw 会复活两个空死列,steps.md 的「已知事项」引它做补救)。
// 放 archive/_ 下 = 链外,不会进清单、不会被 GO 自动执行。
copyFileSync(join(TOOLS, 'archive', '_registry-audit-20261008', '_cleanup-stray-whloc-cols-test.sql'),
             join(PKG, 'tools', 'archive', '_registry-audit-20261008', '_cleanup-stray-whloc-cols-test.sql'));

writeFileSync(join(PKG, `to-run-${TAG}.txt`), toRun.join('\n') + '\n');

// bat:把仓库版里的旧 to-run 名/条数描述改写为本次(GO 流程本身不变)
const subBat = (src, dst, desc) => {
  let t = readFileSync(join(DEPLOY, src), 'utf8');
  const before = t;
  t = t.replaceAll('to-run-20261004.txt', `to-run-${TAG}.txt`).replaceAll('to-run-20261007.txt', `to-run-${TAG}.txt`);
  t = t.replace(/force-run to-run list \((\d+) entries:[^)]*\)/, `force-run to-run list (${toRun.length} entries: ${desc})`);
  if (t === before) throw new Error(`${src}: 没有发生替换,to-run 名可能已变,请人工检查`);
  writeFileSync(join(PKG, dst), t);
};
subBat('deploy-incremental.bat', 'deploy-incremental.bat', `${toRun.length} 新增 + 0 哈希重跑 + 0 虚账补跑`);
subBat('apply-migrations.bat', 'apply-migrations.bat', `${toRun.length} 新增`);

copyFileSync(STEPS_SRC, join(PKG, 'steps.md'));
if (!existsSync(join(PKG, 'steps.md'))) throw new Error('steps.md 未能拷入包内');

// ---------- SHA256SUMS ----------
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(PKG);
const lines = files.map((f) => {
  const h = createHash('sha256').update(readFileSync(f)).digest('hex');
  return `${h}  ${relative(PKG, f).replace(/\\/g, '/')}`;
}).sort();
writeFileSync(join(PKG, 'SHA256SUMS.txt'), lines.join('\n') + '\n');

const jarHash = createHash('sha256').update(readFileSync(join(PKG, 'app.jar'))).digest('hex');
console.log(`\n组装完成: ${PKG}`);
console.log(`  文件 ${files.length + 1} 个;app.jar ${(statSync(join(PKG, 'app.jar')).size / 1048576).toFixed(1)} MB`);
console.log(`  app.jar SHA256 = ${jarHash}`);
console.log(`  to-run-${TAG}.txt(${toRun.length} 条):`);
toRun.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. ${s}`));
writeFileSync(join(ROOT, 'tools/archive/_pkg-incr-20261008/_build-jar-sha.txt'), jarHash + '\n');

if (ZIP) {
  const zip = join(DEPLOY, `pkg-incr-${TAG}.zip`);
  if (existsSync(zip)) rmSync(zip);
  sh('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${PKG}\\*' -DestinationPath '${zip}' -Force`]);
  const h = createHash('sha256').update(readFileSync(zip)).digest('hex');
  console.log(`\nZIP: ${zip}  ${(statSync(zip).size / 1048576).toFixed(1)} MB`);
  console.log(`ZIP SHA256 = ${h}`);
}
