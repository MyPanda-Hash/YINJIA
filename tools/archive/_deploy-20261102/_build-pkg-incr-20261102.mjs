#!/usr/bin/env node
/**
 * _build-pkg-incr-20261102.mjs — 组装增量部署包 deploy/pkg-incr-20261102/
 *
 * 与 pkg-incr-20261010 同一套纪律（那个包已成功上线，见 部署说明.md §A9）：
 *   · 三件套咬合：同一 HEAD 的 jar + manifest + 仅清单内脚本；
 *   · .bat 生成时强制 CRLF + 纯 ASCII（纯 LF/中文 bat 会被 cmd 逐行撕碎）；
 *   · SHA256SUMS 最后生成、覆盖全包；包目录被 .gitignore 排除（deploy/pkg-*），不入库。
 *
 * 与上包的差别：**to-run 不按 git diff 算，而是按服务器 yj_schema_log 实测差集算**
 *   —— 因为本次的起点不是某个提交，而是「服务器库停在 2026-11-01 + jar 已被手工换成
 *   cd23c98f…（2026-11-02 10:07）」。git diff 会把「已应用但提交在其后」的脚本误判成新增。
 *   实测差集 = 清单 692 条里服务器缺 6 条（全部 20261030 手机领料系列），见 steps.md。
 *
 * 用法：node tools/archive/_deploy-20261102/_build-pkg-incr-20261102.mjs [--zip]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TOOLS = join(ROOT, 'tools');
const DEPLOY = join(ROOT, 'deploy');
const TAG = '20261102';
const PKG = join(DEPLOY, `pkg-incr-${TAG}`);
const HERE = join(TOOLS, 'archive', `_deploy-${TAG}`);
const TORUN_SRC = join(HERE, `to-run-${TAG}.txt`);
const STEPS_SRC = join(HERE, 'steps.md');
const ZIP = process.argv.includes('--zip');

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const manifest = readFileSync(join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));

const toRun = readFileSync(TORUN_SRC, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));
for (const s of toRun) {
  if (!manifest.includes(s)) throw new Error(`to-run 里的 ${s} 不在 db-migrations.txt 清单内`);
  if (!existsSync(join(TOOLS, s))) throw new Error(`to-run 里的 ${s} 在 tools/ 下不存在`);
}
if (!toRun.length) throw new Error('to-run 为空');
if (!existsSync(STEPS_SRC)) throw new Error(`缺 ${STEPS_SRC}`);
if (!existsSync(join(DEPLOY, 'app.jar'))) throw new Error('缺 deploy/app.jar（先把 build-appjar 的产物复制过来）');

// to-run 的相对顺序必须与清单一致
const idx = (s) => manifest.indexOf(s);
const sorted = [...toRun].sort((a, b) => idx(a) - idx(b));
if (sorted.join('|') !== toRun.join('|')) throw new Error('to-run 顺序与清单顺序不一致，请按清单顺序排列');

const HEAD = sh('git', ['rev-parse', '--short', 'HEAD']);
console.log(`HEAD=${HEAD}  清单 ${manifest.length} 条  to-run ${toRun.length} 条`);

// ---------- 组装 ----------
if (existsSync(PKG)) rmSync(PKG, { recursive: true, force: true });
mkdirSync(join(PKG, 'tools', 'lib'), { recursive: true });
mkdirSync(join(PKG, 'tools', 'verify'), { recursive: true });

copyFileSync(join(DEPLOY, 'app.jar'), join(PKG, 'app.jar'));
for (const s of manifest) copyFileSync(join(TOOLS, s), join(PKG, 'tools', s));
for (const f of ['DbSync.java', 'db-migrations.txt']) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
copyFileSync(join(TOOLS, 'lib', 'mssql-jdbc.jar'), join(PKG, 'tools', 'lib', 'mssql-jdbc.jar'));
for (const f of ['verify-package.ps1', 'probe-login.ps1']) copyFileSync(join(DEPLOY, f), join(PKG, f));

// 服务器侧自证工具（四单闸 / 库体检）
for (const f of ['FourDocAudit.java', 'DbNormAudit.java']) copyFileSync(join(TOOLS, 'verify', f), join(PKG, 'tools', 'verify', f));
for (const f of ['fourdoc-baseline.tsv', 'db-legacy-whitelist.txt']) {
  if (existsSync(join(TOOLS, f))) copyFileSync(join(TOOLS, f), join(PKG, 'tools', f));
}

// to-run：通用名 + 带日期名都写一份（deploy-incremental.bat 先用通用名）
writeFileSync(join(PKG, 'to-run.txt'), toRun.join('\n') + '\n');
writeFileSync(join(PKG, `to-run-${TAG}.txt`), toRun.join('\n') + '\n');

// bat：改写 to-run 文件名，并强制 CRLF + 纯 ASCII
const toCrlf = (s) => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const subBat = (src, dst, desc, mustChange = true) => {
  let t = readFileSync(join(DEPLOY, src), 'utf8');
  const before = t;
  for (const old of ['to-run-20261004.txt', 'to-run-20261007.txt', 'to-run-20261008.txt', 'to-run-20261010.txt', 'to-run-20261021.txt', 'to-run-20261101.txt']) {
    t = t.replaceAll(old, `to-run-${TAG}.txt`);
  }
  t = t.replace(/force-run (\d+) entries from/, `force-run ${toRun.length} entries from`);
  t = t.replace(/force-run to-run list \((\d+) entries:[^)]*\)/, `force-run to-run list (${toRun.length} entries: ${desc})`);
  if (mustChange && t === before && !t.includes(`to-run-${TAG}.txt`)) {
    throw new Error(`${src}: 没有发生替换，to-run 名可能已变，请人工检查`);
  }
  t = toCrlf(t);
  const bad = [...t].filter((c) => c.charCodeAt(0) > 0x7e || (c.charCodeAt(0) < 0x20 && c !== '\r' && c !== '\n'));
  if (bad.length) throw new Error(`${dst}: 含 ${bad.length} 个非 ASCII 字节 —— .bat 必须纯 ASCII`);
  if (/(?<!\r)\n/.test(t)) throw new Error(`${dst}: 仍有裸 LF`);
  writeFileSync(join(PKG, dst), t);
  console.log(`  · ${dst}: CRLF 归一 + 纯 ASCII 校验通过（${t.split('\r\n').length - 1} 行）`);
};
subBat('deploy-incremental.bat', 'deploy-incremental.bat', `${toRun.length} new (server ledger gap)`);
subBat('apply-migrations.bat', 'apply-migrations.bat', `${toRun.length} total`);
subBat('deploy-production.bat', 'deploy-production.bat', '', false);
copyFileSync(STEPS_SRC, join(PKG, 'steps.md'));

// ---------- SHA256SUMS（最后，覆盖全包） ----------
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
