#!/usr/bin/env node
/**
 * _build-pkg-incr-20261010.mjs — 组装增量部署包 deploy/pkg-incr-20261010/
 *
 * 沿用 pkg-incr-20261008 的纪律(那个包已实践过一次成功上线,见 部署说明.md §A8):
 *   · 三件套咬合:同一 HEAD 的 jar + manifest + **仅清单内**脚本;
 *   · to-run 不手列:由 git 的「新增」+「字节变更」两个集合与清单取交算出;
 *   · .bat 生成时强制 **CRLF + 纯 ASCII**,并加硬闸(§A8 经验①:纯 LF/中文 bat 会被 cmd 逐行撕碎);
 *   · SHA256SUMS 最后生成、覆盖全包;包目录 gitignore 不入库(与 10-07/10-08 同例)。
 *
 * 与上个包的差别:
 *   · 本次是**大版本**(149 个提交、35 条新迁移 + 4 条字节变更),不涉及「口径 A/B」那种取舍 ⇒ 去掉变体文件;
 *   · 基准提交 = `57bc2914` —— 服务器当前 jar(SHA ca386364…) 的构建来源,也就是本次部署的起点。
 *
 * 用法: node tools/archive/_pkg-incr-20261010/_build-pkg-incr-20261010.mjs [--zip]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TOOLS = join(ROOT, 'tools');
const DEPLOY = join(ROOT, 'deploy');
const TAG = '20261010';
const PKG = join(DEPLOY, `pkg-incr-${TAG}`);
/** 本次部署的起点:服务器当前跑的那个 jar 的构建来源(部署说明.md §A8 记录:jar SHA ca386364…) */
const BASE_HEAD = '57bc2914';
const ZIP = process.argv.includes('--zip');
const STEPS_SRC = join(TOOLS, 'archive', `_pkg-incr-${TAG}`, 'steps.md');

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const manifest = readFileSync(join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));
const HEAD = sh('git', ['rev-parse', '--short', 'HEAD']);

// to-run = 清单里「基准之后新增」∪「基准之后字节变更」的脚本(顺序仍按清单)
const added = new Set(sh('git', ['diff', '--diff-filter=A', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const modified = new Set(sh('git', ['diff', '--diff-filter=M', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools'])
  .split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).map((f) => f.replace(/^tools\//, '')));
const toRun = manifest.filter((s) => added.has(s) || modified.has(s));
const addedListed = toRun.filter((s) => added.has(s));
const modListed = toRun.filter((s) => modified.has(s));
const addedUnlisted = [...added].filter((s) => !manifest.includes(s));

console.log(`HEAD=${HEAD}  基准(BASE_HEAD)=${BASE_HEAD}`);
console.log(`清单 ${manifest.length} 条;新增 ${addedListed.length} 条(其中进链 ${addedListed.length})、字节变更 ${modListed.length} 条;退场 ${sh('git', ['diff', '--diff-filter=D', '--name-only', BASE_HEAD, 'HEAD', '--', 'tools']).split(/\r?\n/).filter((f) => /^tools\/[^/]+\.sql$/.test(f)).length} 条`);
if (addedUnlisted.length) console.log(`  ⚠ 新增但不在清单(不进包,应为链外/探针): ${addedUnlisted.join(', ')}`);
if (toRun.length === 0) throw new Error('to-run 为空 —— 基准提交可能选错了');
if (!existsSync(STEPS_SRC)) throw new Error(`缺 ${STEPS_SRC}`);

// ---------- 组装 ----------
if (existsSync(PKG)) rmSync(PKG, { recursive: true, force: true });
mkdirSync(join(PKG, 'tools', 'lib'), { recursive: true });

copyFileSync(join(DEPLOY, 'app.jar'), join(PKG, 'app.jar'));
for (const s of manifest) copyFileSync(join(TOOLS, s), join(PKG, 'tools', s));
for (const f of ['DbSync.java', 'db-migrations.txt']) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
copyFileSync(join(TOOLS, 'lib', 'mssql-jdbc.jar'), join(PKG, 'tools', 'lib', 'mssql-jdbc.jar'));
for (const f of ['verify-package.ps1', 'probe-login.ps1']) copyFileSync(join(DEPLOY, f), join(PKG, f));

// 回归闸与体检(§A8 经验④:让服务器侧能自证)
mkdirSync(join(PKG, 'tools', 'verify'), { recursive: true });
mkdirSync(join(PKG, 'tools', 'archive', '_dump-out'), { recursive: true });
mkdirSync(join(PKG, 'tools', 'archive', '_registry-audit-20261008'), { recursive: true });
for (const f of ['FourDocAudit.java', 'DbNormAudit.java']) copyFileSync(join(TOOLS, 'verify', f), join(PKG, 'tools', 'verify', f));
for (const f of ['fourdoc-baseline.tsv', 'db-legacy-whitelist.txt']) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
copyFileSync(join(TOOLS, 'archive', '_dump-out', '_head-fields-HSDZ_MES.md'),
             join(PKG, 'tools', 'archive', '_dump-out', '_head-fields-HSDZ_MES.md'));
copyFileSync(join(TOOLS, 'archive', '_registry-audit-20261008', '_cleanup-stray-whloc-cols-test.sql'),
             join(PKG, 'tools', 'archive', '_registry-audit-20261008', '_cleanup-stray-whloc-cols-test.sql'));

writeFileSync(join(PKG, `to-run-${TAG}.txt`), toRun.join('\n') + '\n');

// bat:改写 to-run 文件名与条数描述,并**强制 CRLF + 纯 ASCII**(§A8 经验①)
const toCrlf = (s) => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const subBat = (src, dst, desc) => {
  let t = readFileSync(join(DEPLOY, src), 'utf8');
  const before = t;
  t = t.replaceAll('to-run-20261004.txt', `to-run-${TAG}.txt`)
       .replaceAll('to-run-20261007.txt', `to-run-${TAG}.txt`)
       .replaceAll('to-run-20261008.txt', `to-run-${TAG}.txt`);
  t = t.replace(/force-run to-run list \((\d+) entries:[^)]*\)/, `force-run to-run list (${toRun.length} entries: ${desc})`);
  if (t === before) throw new Error(`${src}: 没有发生替换,to-run 名可能已变,请人工检查`);
  t = toCrlf(t);
  const bad = [...t].filter((c) => c.charCodeAt(0) > 0x7e || (c.charCodeAt(0) < 0x20 && c !== '\r' && c !== '\n'));
  if (bad.length) throw new Error(`${dst}: 含 ${bad.length} 个非 ASCII 字节(${[...new Set(bad)].slice(0, 8).join(' ')}) —— .bat 必须纯 ASCII`);
  if (/(?<!\r)\n/.test(t)) throw new Error(`${dst}: 仍有裸 LF`);
  writeFileSync(join(PKG, dst), t);
  console.log(`  · ${dst}: CRLF 归一 + 纯 ASCII 校验通过(${t.split('\r\n').length - 1} 行)`);
};
subBat('deploy-incremental.bat', 'deploy-incremental.bat', `${addedListed.length} new + ${modListed.length} modified rerun`);
subBat('apply-migrations.bat', 'apply-migrations.bat', `${toRun.length} total`);
copyFileSync(STEPS_SRC, join(PKG, 'steps.md'));

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
console.log(`\n组装完成: ${PKG}`);
console.log(`  文件 ${files.length + 1} 个;app.jar ${(statSync(join(PKG, 'app.jar')).size / 1048576).toFixed(1)} MB;SHA256 = ${jarHash}`);
console.log(`  to-run-${TAG}.txt(${toRun.length} 条):`);
toRun.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. ${s}`));

if (ZIP) {
  const zip = join(DEPLOY, `pkg-incr-${TAG}.zip`);
  if (existsSync(zip)) rmSync(zip);
  sh('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${PKG}\\*' -DestinationPath '${zip}' -Force`]);
  const h = createHash('sha256').update(readFileSync(zip)).digest('hex');
  console.log(`\nZIP: ${zip}  ${(statSync(zip).size / 1048576).toFixed(1)} MB`);
  console.log(`ZIP SHA256 = ${h}`);
}
