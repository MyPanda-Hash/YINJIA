#!/usr/bin/env node
/**
 * predeploy-rehearsal.mjs — **打包前强制重跑演练闸**(2026-10-10 定型,部署说明.md §A9 教训①)
 *
 * 为什么需要它(血泪出处):
 *   2026-10-10 的 pkg-incr-20261010 首轮 GO 在两处脚本上失败、还埋了一处隐性缺陷,三条同源 ——
 *   **脚本字节一改,DbSync 下次就会把它判为「变更」并强制重跑;而历史脚本重跑会撞上后续的
 *   schema 演进与基线刷新**:① 老脚本无条件 DROP+CREATE VIEW 撞已下线列(视图当场丢);
 *   ② 自检硬编码「四单字段行数应 329」在基线刷新后必然误报;③ 对齐脚本内嵌 10-08 的四单覆写,
 *   排在回正脚本之后 ⇒ 每次跑都把四单改回旧口径。**这三条都能在打包前用本工具当场抓出。**
 *
 * 它做什么:把给定 to-run 清单里的每条脚本,在指定账套上**逐条 `DbSync run`(强制)** 一遍,
 *   任一失败即判「不可打包」(exit 1)。脚本按设计幂等 ⇒ 演练本身是安全的(会把已应用的重放一遍)。
 *
 * 用法(在**仓库根**或 tools 目录下均可):
 *   node tools/verify/predeploy-rehearsal.mjs deploy/pkg-incr-20261010/to-run-20261010.txt
 *   node tools/verify/predeploy-rehearsal.mjs <to-run 文件> HSDZ_MES           # 只跑正式账套
 *   node tools/verify/predeploy-rehearsal.mjs <to-run 文件> HSDZ_MES HSDZ_MES_TEST
 *   默认:两个账套都跑(先正式、后测试)——与「一切库变更必须两个账套都执行」一致。
 *
 * 退出码:0 = 全通过(可打包);1 = 有失败(逐条列出脚本名与首行报错)。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = resolve(process.cwd().endsWith('tools') ? join(process.cwd(), '..') : process.cwd());
const TOOLS = join(ROOT, 'tools');
const JAVA = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';

/** 未显式给清单时,自动取最新一个部署包的 to-run 文件 */
function autoToRun() {
  const deploy = join(ROOT, 'deploy');
  if (!existsSync(deploy)) return null;
  const pkgs = readdirSync(deploy).filter((d) => d.startsWith('pkg-incr-') && existsSync(join(deploy, d))).sort().reverse();
  for (const p of pkgs) {
    const hits = readdirSync(join(deploy, p)).filter((f) => /^to-run-.*\.txt$/.test(f)).sort().reverse();
    if (hits.length) return join(deploy, p, hits[0]);
  }
  return null;
}

const arg1 = process.argv[2];
const toRunFile = arg1 && !arg1.startsWith('HSDZ_') ? resolve(arg1) : autoToRun();
const dbs = process.argv.slice(arg1 && !arg1.startsWith('HSDZ_') ? 3 : 2).filter((a) => a.startsWith('HSDZ_'));
if (dbs.length === 0) dbs.push('HSDZ_MES', 'HSDZ_MES_TEST');

if (!toRunFile || !existsSync(toRunFile)) {
  console.error('[FATAL] 找不到 to-run 清单。用法: node tools/verify/predeploy-rehearsal.mjs <to-run 文件> [账套…]');
  process.exit(2);
}
const scripts = readFileSync(toRunFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((t) => t && !t.startsWith('#'));

console.log(`=== 打包前强制重跑演练 ===`);
console.log(`  清单: ${toRunFile}`);
console.log(`  脚本: ${scripts.length} 条;账套: ${dbs.join(' / ')}`);
console.log(`  Java: ${JAVA}`);
console.log('');

let totalFail = 0;
for (const db of dbs) {
  console.log(`──── ${db} ────`);
  const failed = [];
  let n = 0;
  for (const s of scripts) {
    n++;
    const t0 = Date.now();
    const r = spawnSync(JAVA, ['-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8',
      '-cp', 'lib' + (process.platform === 'win32' ? '\\' : '/') + 'mssql-jdbc.jar', 'DbSync.java', 'run', s],
      { cwd: TOOLS, encoding: 'utf8', env: { ...process.env, YINJIA_SQL_DB: db }, maxBuffer: 1 << 28 });
    const out = (r.stdout || '') + (r.stderr || '');
    const ok = r.status === 0 && !/\[SQL失败\]/.test(out);
    const ms = Date.now() - t0;
    if (!ok) {
      const errLine = (out.split(/\r?\n/).find((l) => /\[SQL失败\]|\[FATAL\]|错误/.test(l)) || '').trim();
      failed.push({ s, errLine });
      console.log(`  [${String(n).padStart(2)}/${scripts.length}] FAIL  ${s}  (${ms}ms)`);
      if (errLine) console.log(`           ${errLine}`);
    } else {
      console.log(`  [${String(n).padStart(2)}/${scripts.length}] ok    ${s}  (${ms}ms)`);
    }
  }
  console.log('');
  if (failed.length === 0) {
    console.log(`  ⇒ ${db}: ${scripts.length}/${scripts.length} 通过 ✅`);
  } else {
    totalFail += failed.length;
    console.log(`  ⇒ ${db}: ${scripts.length - failed.length}/${scripts.length} 通过;**${failed.length} 条失败** ❌`);
    failed.forEach((f) => console.log(`     · ${f.s}   ${f.errLine}`));
  }
  console.log('');
}

if (totalFail === 0) {
  console.log('RESULT: REHEARSAL-OK —— 可打包(每条 to-run 脚本在两个账套上都能重跑成功)');
  process.exit(0);
}
console.log(`RESULT: REHEARSAL-FAIL —— 共 ${totalFail} 处失败;**先修脚本再打包**。`);
console.log('  修法参照 部署说明.md §A9 与 AGENTS.md「打包前后必做两道闸」:');
console.log('  ① 撞已下线列 → 血统二择一(列在才做,或改用存在守卫/动态 SQL);');
console.log('  ② 自检硬编码绝对值 → 改成前后对比;');
console.log('  ③ 与权威基线抢写(如内嵌某日四单取值)→ 摘掉该部分,以基线为唯一权威。');
process.exit(1);
