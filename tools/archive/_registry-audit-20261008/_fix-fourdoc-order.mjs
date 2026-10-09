#!/usr/bin/env node
/**
 * _fix-fourdoc-order.mjs — 修正 tools/db-migrations.txt 里三条四单脚本的登记顺序
 *
 * 缺陷(2026-10-08 打包前核查发现):
 *   migrate-fourdoc-bloodline-cols-20261008.sql:21  「本脚本排在回正脚本之前」
 *   migrate-fourdoc-missing-cols-20261008.sql:14-15 「本脚本必须排在回正脚本
 *       migrate-fourdoc-baseline-restore-20261008.sql 之前(**登记顺序即执行顺序**)」
 *   而清单实际顺序是: baseline-restore(2492) → bloodline-cols(2502) → missing-cols(2512)  —— **反了**。
 *
 * 影响:回正脚本按基线 dump 重建 yj_field,会为「物理列尚不存在」的 5 个字段插入登记行 ⇒
 *   中间态触发 DbNormAudit 05「元数据漂移(字段不在其所在对象里)」,面板打开即 Invalid column name;
 *   靠紧随其后的补列脚本才自愈。新库从零跑链 / 补列脚本失败时就会停在坏态 —— 作者本意正是用顺序避免它。
 *
 * 做法:把「回正脚本的注释块 + 条目」整块移到两条补列脚本之后;并在其注释里写明为何必须在后。
 * 幂等:已修则打印 [SKIP] 不改字节。
 *
 * 用法: node tools/archive/_registry-audit-20261008/_fix-fourdoc-order.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const file = join(process.cwd(), 'db-migrations.txt');
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');

const RESTORE = 'migrate-fourdoc-baseline-restore-20261008.sql';
const BLOOD = 'migrate-fourdoc-bloodline-cols-20261008.sql';
const MISSING = 'migrate-fourdoc-missing-cols-20261008.sql';

const idxOf = (name) => {
  const hits = lines.map((l, i) => (l.trim() === name && !l.trim().startsWith('#') ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`${name} 在清单里出现 ${hits.length} 次(期望 1)`);
  return hits[0];
};
const iR = idxOf(RESTORE), iB = idxOf(BLOOD), iM = idxOf(MISSING);
console.log(`当前位置: restore=${iR + 1}  bloodline=${iB + 1}  missing=${iM + 1}`);

if (iR > iB && iR > iM) {
  console.log('[SKIP] 回正脚本已在两条补列脚本之后,顺序正确,不改字节');
  process.exit(0);
}
if (!(iR < iB && iB < iM)) throw new Error('三条脚本不是按 restore→bloodline→missing 的预期形态排列,请人工检查');

/** 取「紧邻条目上方的连续注释块 + 条目 + 其后的一个空行」为一块 */
function blockAt(entryIdx) {
  let start = entryIdx;
  while (start - 1 >= 0 && lines[start - 1].trim().startsWith('#')) start--;
  let end = entryIdx + 1;
  if (lines[end] !== undefined && lines[end].trim() === '') end++;
  return { start, end };
}

const blkR = blockAt(iR);
const rBlock = lines.slice(blkR.start, blkR.end);

// 在回正脚本注释块末尾(条目行之前)插入一行说明其位置要求
const noteLine = '#   ⚠ 顺序(2026-10-08 打包前修正):本脚本必须在上面两条补列脚本**之后** —— 它按基线 dump 重建';
const noteLine2 = '#     yj_field,会为基线档登记但物理列尚不存在的字段插行;先补列再回正才不会留下「字段指向不存在的列」的中间态。';
const insertAt = blkR.end - 1 - (rBlock[rBlock.length - 1].trim() === '' ? 1 : 0); // 条目行下标
const restored = [...rBlock];
restored.splice(restored.length - (restored[restored.length - 1].trim() === '' ? 1 : 0), 0, noteLine, noteLine2);

// 移除原块,再把(加注后的)块插到 missing-cols 块之后
const out = [...lines];
out.splice(blkR.start, blkR.end - blkR.start);
const iM2 = out.findIndex((l) => l.trim() === MISSING);
const blkM = (() => { let s = iM2; while (s - 1 >= 0 && out[s - 1].trim().startsWith('#')) s--; let e = iM2 + 1; if (out[e] !== undefined && out[e].trim() === '') e++; return { s, e }; })();
out.splice(blkM.e, 0, ...restored);

const next = out.join('\n');
if (next === raw) { console.log('[SKIP] 内容无变化'); process.exit(0); }
if (!APPLY) { console.log('[DRY-RUN] 会重排;加 --apply 落盘'); process.exit(0); }
writeFileSync(file, next);
console.log('[OK] 已重排');

// 自检
const chk = readFileSync(file, 'utf8').split('\n');
const p = (n) => chk.findIndex((l) => l.trim() === n) + 1;
console.log(`    新顺序: bloodline=${p(BLOOD)}  missing=${p(MISSING)}  restore=${p(RESTORE)}`);
if (!(p(BLOOD) < p(RESTORE) && p(MISSING) < p(RESTORE))) throw new Error('重排后仍未满足依赖!');
const entries = chk.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
console.log(`    清单条目数: ${entries.length}(应与改前一致),重复条目: ${entries.length - new Set(entries).size}`);
