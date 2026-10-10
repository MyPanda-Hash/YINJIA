/**
 * _merge-inuse-tables.cjs — 合并 tools/db-inuse-tables.txt(两侧都是整份重写,只能按集合运算合)
 *
 * 口径:
 *   结果 = 远端(spine) − 本地删掉的表(localRemoved) + 本地新增的表(localAdded)
 *   · localRemoved/localAdded 由 base(合并基)↔ 本地 求差得出,不是靠眼看;
 *   · 各分组标题里的「(N 张)」按合并后的实际条目数重算;
 *   · 头部说明块取「本地版」(它把例外保留/用法写得更全),尾部附本次合并说明。
 * 用 `--dry` 只打印不落盘。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const REL = 'tools/db-inuse-tables.txt';
const dry = process.argv.includes('--dry');

// 三版快照由 pwsh 预先导出(沙箱禁止 node 起子进程抓管道输出):
//   git show <base>:tools/db-inuse-tables.txt > _inuse-base.txt 等
const snapshot = (name) => {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) throw new Error('缺快照 ' + name + '(先用 pwsh 导出)');
  return fs.readFileSync(p, 'utf8');
};

const parse = (text) => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const tables = [];
  const sections = [];
  for (const l of lines) {
    const m = /^table:([^\s#]+)/.exec(l);
    if (m) tables.push(m[1]);
    if (/^#\s*-{2,}/.test(l)) sections.push(l);
  }
  return { lines, tables, sections };
};

const base = parse(snapshot('_inuse-base.txt'));
const local = parse(snapshot('_inuse-local.txt'));
const origin = parse(snapshot('_inuse-origin.txt'));

const setOf = (a) => new Set(a.tables);
const bS = setOf(base), lS = setOf(local), oS = setOf(origin);
const localRemoved = base.tables.filter((t) => !lS.has(t));
const localAdded = local.tables.filter((t) => !bS.has(t));
const originAdded = origin.tables.filter((t) => !bS.has(t));
const originRemoved = base.tables.filter((t) => !oS.has(t));

console.log('基数 base=' + bS.size + ' 本地=' + lS.size + ' 远端=' + oS.size);
console.log('\n本地删除的表(' + localRemoved.length + '):\n  ' + localRemoved.join('\n  '));
console.log('\n本地新增的表(' + localAdded.length + '):\n  ' + (localAdded.join('\n  ') || '(无)'));
console.log('\n远端新增的表(' + originAdded.length + '):\n  ' + originAdded.join('\n  '));
console.log('\n远端删除的表(' + originRemoved.length + '):\n  ' + (originRemoved.join('\n  ') || '(无)'));

// ── 合并:以远端为骨架,删掉本地删的表,补上本地增的表 ──
const drop = setOf({ tables: localRemoved });
const keepLocalAdd = localAdded.filter((t) => !oS.has(t));
const out = [];
let lastSectionIdx = -1;
for (const l of origin.lines) {
  const m = /^table:([^\s#]+)/.exec(l);
  if (m && drop.has(m[1])) continue;              // 本地已下架 ⇒ 不登记
  if (/^#\s*-{2,}/.test(l)) lastSectionIdx = out.length;
  out.push(l);
}
// 本地新增的表(远端没有的)追加到最后一个分组末尾
if (keepLocalAdd.length) {
  const localLines = local.lines.filter((l) => {
    const m = /^table:([^\s#]+)/.exec(l);
    return m && keepLocalAdd.includes(m[1]);
  });
  out.splice(lastSectionIdx + 1, 0, ...localLines);
}

// ── 重算各分组标题里的「(N 张)」 ──
const lines2 = [];
let curSectionStart = -1;
const flushCount = (endExclusive) => {
  if (curSectionStart < 0) return;
  const body = lines2.slice(curSectionStart + 1, endExclusive);
  const n = body.filter((l) => /^table:/.test(l)).length;
  lines2[curSectionStart] = lines2[curSectionStart].replace(/\((\d+)\s*张/, `(${n} 张`);
};
for (let i = 0; i < out.length; i++) {
  if (/^#\s*-{2,}/.test(out[i])) { flushCount(i); curSectionStart = i; }
  lines2.push(out[i]);
}
flushCount(lines2.length);

const total = lines2.filter((l) => /^table:/.test(l)).length;

const finalLines = lines2.map((l) => {
  // 尾部合计行按合并后实际数重算(在册 = 总条目 − 例外保留 3 张)
  const m = /^#\s*合计\s*(\d+)\s*张在册\s*\+\s*(\d+)\s*张例外保留\s*=\s*(\d+)\s*张/.exec(l);
  if (!m) return l;
  const kept = Number(m[2]);
  const reg = total - kept;
  return `# 合计 ${reg} 张在册 + ${kept} 张例外保留 = ${total} 张(与数据库表清单 §0.1 同源;新表必须登记,否则视为脏数据);`;
});
// 合并说明:紧跟在合计行之后,便于日后回溯这次合并做了什么
const sumIdx = finalLines.findIndex((l) => /^#\s*合计\s*\d+\s*张在册/.test(l));
if (sumIdx >= 0) {
  finalLines.splice(sumIdx + 1, 0,
    '# 2026-10-09 合并 origin/main:远端新增 13 表全部登记(qc_{mold,cut,asm}_insp_head/_detail、wo_transfer_log、',
    '#   wo_split_log、wo_process_line、rd_asm_bom_head/_detail、rd_mold_formula_head/_detail);',
    '#   本地下架 17 表同步撤销登记(请购单/其他出入库/委外 10 张 + 品质管理无用 5 面板 7 张)。');
}
const finalText = finalLines.join('\n');
console.log('\n合并后:分组 ' + finalLines.filter((l) => /^#\s*-{2,}/.test(l)).length + ' 个,在册表 ' + total + ' 张');

if (!dry) {
  fs.writeFileSync(path.join(ROOT, REL), finalText, 'utf8');
  console.log('已写入 ' + REL);
}
