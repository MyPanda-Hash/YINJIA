#!/usr/bin/env node
/**
 * _build-pkg-incr-20261106.mjs — 组装增量部署包 deploy/pkg-incr-20261106/
 *
 * 沿用 pkg-incr-20261010 的纪律(见 部署说明.md §A9):
 *   · 三件套咬合:同一 HEAD 的 jar + manifest + **仅清单内**脚本;
 *   · to-run 不手列:git 的「新增」「字节变更」两个集合 ∩ 清单;
 *   · .bat 一律 CRLF + 纯 ASCII(硬闸);SHA256SUMS 最后生成、覆盖全包。
 *
 * 与 20261010 的差别:
 *   · 基准 = `db96994cb` —— 服务器现役 jar(SHA e4b6e454…,入口 index-DzVhzlzW.js、ledger 754)的构建来源;
 *   · 本次新增的 `migrate-drop-bak-tables-20261106.sql` **尚未提交**,git diff 看不到 ⇒ 显式追加,
 *     并断言它在 manifest 里(打包后仍要提交,见 steps.md §6)。
 *
 * 用法: node tools/archive/_pkg-incr-20261106/_build-pkg-incr-20261106.mjs [--zip]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TOOLS = join(ROOT, 'tools');
const DEPLOY = join(ROOT, 'deploy');
const TAG = '20261106';
const PKG = join(DEPLOY, `pkg-incr-${TAG}`);
const BASE_HEAD = 'db96994cb';
const ZIP = process.argv.includes('--zip');
const STEPS_SRC = join(TOOLS, 'archive', `_pkg-incr-${TAG}`, 'steps.md');
/** 显式进 to-run 的脚本(不靠 git diff):
 *  - migrate-drop-bak-tables-20261106.sql:本次新增、尚未提交,git diff 看不到;
 *  - migrate-sample-int-flat-20261106.sql:在基准提交里(22:31 那次部署应已执行,ledger 753→754),
 *    但服务器备份(21:22)里还没生效 ⇒ 幂等重放一次兜底(脚本自带 [PASS] 自检)。 */
const EXPLICIT_TO_RUN = [
  'migrate-sample-int-flat-20261106.sql',
  'migrate-drop-bak-tables-20261106.sql',
];

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const manifest = readFileSync(join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));
const HEAD = sh('git', ['rev-parse', '--short', 'HEAD']);

const added = new Set(sh('git', ['diff', '--diff-filter=A', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const modified = new Set(sh('git', ['diff', '--diff-filter=M', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const toRun = manifest.filter((s) => added.has(s) || modified.has(s) || EXPLICIT_TO_RUN.includes(s));
const addedListed = toRun.filter((s) => added.has(s));
const modListed = toRun.filter((s) => modified.has(s));

console.log(`HEAD=${HEAD}  基准(BASE_HEAD)=${BASE_HEAD}`);
console.log(`清单 ${manifest.length} 条;新增 ${addedListed.length} + 显式 ${EXPLICIT_TO_RUN.length}、字节变更 ${modListed.length}`);
if (modListed.length) console.log(`  ⚠ 字节变更(需过「三查」): ${modListed.join(', ')}`);
if (!toRun.length) throw new Error('to-run 为空 —— 基准提交可能选错了');
for (const s of toRun) {
  if (!manifest.includes(s)) throw new Error(`to-run 里的 ${s} 不在 manifest,DbSync 会拒绝`);
  if (!existsSync(join(TOOLS, s))) throw new Error(`缺脚本 tools/${s}`);
}
if (!existsSync(STEPS_SRC)) throw new Error(`缺 ${STEPS_SRC}`);

// ---------- 组装 ----------
if (existsSync(PKG)) rmSync(PKG, { recursive: true, force: true });
mkdirSync(join(PKG, 'tools', 'lib'), { recursive: true });

copyFileSync(join(DEPLOY, 'app.jar'), join(PKG, 'app.jar'));
for (const s of manifest) copyFileSync(join(TOOLS, s), join(PKG, 'tools', s));
for (const f of ['DbSync.java', 'db-migrations.txt', 'fourdoc-baseline.tsv', 'db-legacy-whitelist.txt']) {
  copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
}
copyFileSync(join(TOOLS, 'lib', 'mssql-jdbc.jar'), join(PKG, 'tools', 'lib', 'mssql-jdbc.jar'));
for (const f of ['verify-package.ps1', 'probe-login.ps1', 'deploy-incremental.bat', 'apply-migrations.bat']) {
  copyFileSync(join(DEPLOY, f), join(PKG, f));
}
mkdirSync(join(PKG, 'tools', 'verify'), { recursive: true });
for (const f of ['FourDocAudit.java', 'DbNormAudit.java', 'RdAreaEmptyAudit.java']) {
  copyFileSync(join(TOOLS, 'verify', f), join(PKG, 'tools', 'verify', f));
}

// to-run:bat 先找 to-run.txt,旧包名作 fallback ⇒ 两个名字都写,内容一致
const runList = toRun.join('\n') + '\n';
writeFileSync(join(PKG, 'to-run.txt'), runList);
writeFileSync(join(PKG, `to-run-${TAG}.txt`), runList);

// .bat 原样带过来(内容已含 to-run.txt 首选路径),只做 ASCII + CRLF 硬闸;
// apply-migrations.bat 在仓库里是裸 LF,包内必须归一成 CRLF(cmd 按行解析,裸 LF 会被撕碎)
for (const bat of ['deploy-incremental.bat', 'apply-migrations.bat']) {
  let t = readFileSync(join(PKG, bat), 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const bad = [...t].filter((c) => c.charCodeAt(0) > 0x7e || (c.charCodeAt(0) < 0x20 && c !== '\r' && c !== '\n'));
  if (bad.length) throw new Error(`${bat}: 含 ${bad.length} 个非 ASCII 字节 —— .bat 必须纯 ASCII`);
  if (/(?<!\r)\n/.test(t)) throw new Error(`${bat}: 仍有裸 LF`);
  writeFileSync(join(PKG, bat), t);
  console.log(`  · ${bat}: CRLF 归一 + 纯 ASCII 通过(${t.split('\r\n').length - 1} 行)`);
}
copyFileSync(STEPS_SRC, join(PKG, 'steps.md'));

// ---------- 硬闸:包内 tools\*.sql 必须 = 清单里的 distinct 集合 ----------
const pkgSql = new Set(readdirSync(join(PKG, 'tools')).filter((f) => f.endsWith('.sql')));
const absent = manifest.filter((s) => !pkgSql.has(s));
const extra = [...pkgSql].filter((s) => !manifest.includes(s));
if (absent.length) throw new Error(`包内缺 ${absent.length} 个清单脚本`);
if (extra.length) throw new Error(`包内有 ${extra.length} 个清单外脚本: ${extra.join(', ')}`);
console.log(`  · 包内 .sql ${pkgSql.size} 个 = 清单 distinct(${new Set(manifest).size})`);

// ---------- SHA256SUMS(最后,覆盖全包) ----------
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(PKG);
writeFileSync(join(PKG, 'SHA256SUMS.txt'),
  files.map((f) => `${createHash('sha256').update(readFileSync(f)).digest('hex')}  ${relative(PKG, f).replace(/\\/g, '/')}`).sort().join('\n') + '\n');

const jarHash = createHash('sha256').update(readFileSync(join(PKG, 'app.jar'))).digest('hex');
const jar = join(PKG, 'app.jar');
const html = execFileSync('unzip', ['-p', jar, 'BOOT-INF/classes/static/index.html'], { encoding: 'buffer' }).toString('utf8');
const entry = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || ['(未找到)'])[0];
console.log(`\n组装完成: ${PKG}`);
console.log(`  文件 ${files.length + 1} 个;app.jar ${(statSync(jar).size / 1048576).toFixed(1)} MB`);
console.log(`  app.jar SHA256 = ${jarHash}`);
console.log(`  内嵌前端入口 = ${entry}`);
console.log(`  to-run.txt(${toRun.length} 条):`);
toRun.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. ${s}`));

if (ZIP) {
  const zip = join(DEPLOY, `pkg-incr-${TAG}.zip`);
  if (existsSync(zip)) rmSync(zip);
  sh('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${PKG}\\*' -DestinationPath '${zip}' -Force`]);
  const h = createHash('sha256').update(readFileSync(zip)).digest('hex');
  console.log(`\nZIP: ${zip}  ${(statSync(zip).size / 1048576).toFixed(1)} MB`);
  console.log(`ZIP SHA256 = ${h}`);
}
