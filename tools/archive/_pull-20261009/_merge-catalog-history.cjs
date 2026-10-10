/**
 * _merge-catalog-history.cjs — 解决 docs/development/数据库表清单.md 「维护记录」的版本号撞车
 *
 * 情况:两侧同时从 v2.6 往后追加 —— 远端 v2.7…v3.6(2026-10-05 → 10-08),本地 v2.7/v2.8(2026-10-09),
 *   版本号撞了两对。合并口径:保留远端整段(它是较新的一代,且 v3.1/v3.4/v3.5/v3.6 有后续版本依赖),
 *   把本地那两条**改号为 v3.7 / v3.8** 并接在 v3.6 之后(时间上也是最后发生的)。
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '..', '..', 'docs', 'development', '数据库表清单.md');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const iS = lines.findIndex((l) => l.startsWith('<<<<<<<'));
if (iS < 0) { console.log('该文件已无冲突标记,跳过'); process.exit(0); }
const iM = lines.findIndex((l, i) => i > iS && l.startsWith('======='));
const iE = lines.findIndex((l, i) => i > iM && l.startsWith('>>>>>>>'));

const localLines = lines.slice(iS + 1, iM);
const originLines = lines.slice(iM + 1, iE);

// 本地两条 v2.7/v2.8 → v3.7/v3.8
let n = 7;
const renumbered = localLines.map((l) => {
  const m = /^\|\s*v2\.\d+\s*\|\s*2026-10-09\s*\|/.exec(l);
  if (!m) return l;
  const out = l.replace(/^\|\s*v2\.\d+\s*\|/, `| v3.${n} |`);
  n++;
  return out;
});

const merged = [...originLines, ...renumbered];
const out = [...lines.slice(0, iS), ...merged, ...lines.slice(iE + 1)];
const text = out.join('\n');
if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) throw new Error('仍有冲突标记');
fs.writeFileSync(file, text, 'utf8');

console.log('维护记录合并完成:' + originLines.length + ' 条远端 + ' + renumbered.length + ' 条本地改号');
renumbered.forEach((l) => console.log('  ' + l.slice(0, 60) + ' …'));
