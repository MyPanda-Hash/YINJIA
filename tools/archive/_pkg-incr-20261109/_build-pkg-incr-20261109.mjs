#!/usr/bin/env node
/**
 * _build-pkg-incr-20261109.mjs — 组装增量部署包 deploy/pkg-incr-20261109/
 *
 * 沿用 20261010/20261106 的纪律:三件套咬合(同一 HEAD 的 jar + manifest + 仅清单内脚本)、
 * .bat 强制 CRLF+ASCII、SHA256SUMS 最后生成覆盖全包。
 *
 * 与上一个包(20261106)的差别:
 *   · 基准 = `ec0f11f58` —— 服务器现役 jar(SHA 5af36959…,入口 index-e3iBleUE.js,ledger 761)的构建来源;
 *   · to-run 全部来自 git(合并提交里已含),无未提交脚本;
 *   · **补带** `tools/archive/_dump-out/_head-fields-HSDZ_MES.md`(上包漏打,导致 FourDocAudit
 *     的「物理列对账」被跳过)。
 *
 * 用法: node tools/archive/_pkg-incr-20261109/_build-pkg-incr-20261109.mjs [--zip]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TOOLS = join(ROOT, 'tools');
const DEPLOY = join(ROOT, 'deploy');
const TAG = '20261109';
const PKG = join(DEPLOY, `pkg-incr-${TAG}`);
const BASE_HEAD = 'ec0f11f58';
const ZIP = process.argv.includes('--zip');
const STEPS_SRC = join(TOOLS, 'archive', `_pkg-incr-${TAG}`, 'steps.md');

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const manifest = readFileSync(join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));
const HEAD = sh('git', ['rev-parse', '--short', 'HEAD']);

const added = new Set(sh('git', ['diff', '--diff-filter=A', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const modified = new Set(sh('git', ['diff', '--diff-filter=M', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const toRun = manifest.filter((s) => added.has(s) || modified.has(s));

console.log(`HEAD=${HEAD}  基准(BASE_HEAD)=${BASE_HEAD}`);
console.log(`清单 ${manifest.length} 条;新增 ${toRun.filter((s) => added.has(s)).length} 条、字节变更 ${toRun.filter((s) => modified.has(s)).length} 条`);
if (modified.size) console.log(`  ⚠ 字节变更(需过三查): ${[...modified].join(', ')}`);
if (!toRun.length) throw new Error('to-run 为空 —— 基准提交可能选错了');
for (const s of toRun) {
  if (!manifest.includes(s)) throw new Error(`to-run 里的 ${s} 不在 manifest`);
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
// 上包漏带 ⇒ FourDocAudit 的物理列对账会「跳过」;本包补上
mkdirSync(join(PKG, 'tools', 'archive', '_dump-out'), { recursive: true });
const dump = join(TOOLS, 'archive', '_dump-out', '_head-fields-HSDZ_MES.md');
if (existsSync(dump)) {
  copyFileSync(dump, join(PKG, 'tools', 'archive', '_dump-out', '_head-fields-HSDZ_MES.md'));
  console.log('  · 已带 _head-fields-HSDZ_MES.md(物理列对账可用)');
} else {
  console.log('  ⚠ 缺 _head-fields-HSDZ_MES.md —— 物理列对账会跳过');
}

const runList = toRun.join('\n') + '\n';
writeFileSync(join(PKG, 'to-run.txt'), runList);
writeFileSync(join(PKG, `to-run-${TAG}.txt`), runList);

for (const bat of ['deploy-incremental.bat', 'apply-migrations.bat']) {
  let t = readFileSync(join(PKG, bat), 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const bad = [...t].filter((c) => c.charCodeAt(0) > 0x7e || (c.charCodeAt(0) < 0x20 && c !== '\r' && c !== '\n'));
  if (bad.length) throw new Error(`${bat}: 含 ${bad.length} 个非 ASCII 字节`);
  if (/(?<!\r)\n/.test(t)) throw new Error(`${bat}: 仍有裸 LF`);
  writeFileSync(join(PKG, bat), t);
}
copyFileSync(STEPS_SRC, join(PKG, 'steps.md'));

const pkgSql = new Set(readdirSync(join(PKG, 'tools')).filter((f) => f.endsWith('.sql')));
const absent = manifest.filter((s) => !pkgSql.has(s));
const extra = [...pkgSql].filter((s) => !manifest.includes(s));
if (absent.length) throw new Error(`包内缺 ${absent.length} 个清单脚本`);
if (extra.length) throw new Error(`包内有 ${extra.length} 个清单外脚本: ${extra.join(', ')}`);
console.log(`  · 包内 .sql ${pkgSql.size} 个 = 清单 distinct(${new Set(manifest).size})`);

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(PKG);
writeFileSync(join(PKG, 'SHA256SUMS.txt'),
  files.map((f) => `${createHash('sha256').update(readFileSync(f)).digest('hex')}  ${relative(PKG, f).replace(/\\/g, '/')}`).sort().join('\n') + '\n');

const jar = join(PKG, 'app.jar');
const jarHash = createHash('sha256').update(readFileSync(jar)).digest('hex');
const html = execFileSync('unzip', ['-p', jar, 'BOOT-INF/classes/static/index.html'], { encoding: 'buffer' }).toString('utf8');
const entry = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || ['(未找到)'])[0];
console.log(`\n组装完成: ${PKG}`);
console.log(`  文件 ${files.length + 1} 个;app.jar ${(statSync(jar).size / 1048576).toFixed(1)} MB`);
console.log(`  app.jar SHA256 = ${jarHash}`);
console.log(`  内嵌前端入口 = ${entry}`);
console.log(`  to-run(${toRun.length} 条):`);
toRun.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. ${s}`));

if (ZIP) {
  const zip = join(DEPLOY, `pkg-incr-${TAG}.zip`);
  if (existsSync(zip)) rmSync(zip);
  sh('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${PKG}\\*' -DestinationPath '${zip}' -Force`]);
  const h = createHash('sha256').update(readFileSync(zip)).digest('hex');
  console.log(`\nZIP: ${zip}  ${(statSync(zip).size / 1048576).toFixed(1)} MB`);
  console.log(`ZIP SHA256 = ${h}`);
}
