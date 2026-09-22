// _rename-234-level-i18n.mjs — 立项申请表/项目实施计划标题改用设计原文「二三四级」后的词条迁移。
//
// 背景:设计原文是「立项申请表（二三四级项目）」(立项申请表.xlsx B2) 与
//       「项目（二三四级）实施计划」(项目实施计划.xlsx B3),实现此前写成「二三级项目」。
//       docSheetConfigs.js 的 titlePart2 已按设计改为「二三四级项目」/「二三四级」,
//       语言包里旧的 '二三级项目' 键随之变成**无引用死词条**(全仓只有语言包在用它),
//       按仓库「删除功能=代码+翻译一并清理」的规矩:替换成两个新键,旧键删除。
//
// 用法:node tools/archive/_rename-234-level-i18n.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(repo, 'frontend', 'src', 'i18n', 'locales');
const DRY = process.argv.includes('--dry');

const OLD = '二三级项目';
/** 逐语言的新译名:立项申请表用「…项目」,实施计划用括号里的「二三四级」 */
const TEXT = {
  en: ['Level 2/3/4 Project', 'Level 2/3/4'],
  ja: ['二三四級プロジェクト', '二三四級'],
  ko: ['레벨 II·III·IV 프로젝트', '레벨 II·III·IV'],
  es: ['Proyecto de niveles 2/3/4', 'Niveles 2/3/4'],
  fr: ['Projets de niveaux 2/3/4', 'Niveaux 2/3/4'],
  de: ['Projekt der Ebenen 2/3/4', 'Ebenen 2/3/4'],
  ru: ['Проект уровня II/III/IV', 'Уровень II/III/IV'],
  vi: ['Dự án cấp hai/ba/bốn', 'Cấp hai/ba/bốn'],
  th: ['โครงการระดับที่สอง/สาม/สี่', 'ระดับที่สอง/สาม/สี่'],
  'zh-TW': ['二三四級項目', '二三四級'],
};

const problems = [];
const plan = new Map();

for (const [loc, [proj, lvl]] of Object.entries(TEXT)) {
  const file = path.join(DIR, `${loc}.js`);
  if (!fs.existsSync(file)) { problems.push(`${loc}.js 不存在`); continue; }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => l.includes(`'${OLD}'`));
  if (hits.length !== 1) { problems.push(`${loc}.js 命中 ${hits.length} 处(需恰好 1 处)`); continue; }
  const [line, idx] = hits[0];
  const indent = line.match(/^\s*/)[0];
  if (!/^\s*'二三级项目':\s*'.*',\s*$/.test(line)) { problems.push(`${loc}.js 行格式与预期不符: ${JSON.stringify(line)}`); continue; }
  const next = [
    `${indent}'二三四级项目': '${proj}',`,
    `${indent}'二三四级': '${lvl}',`,
  ];
  plan.set(loc, { file, lines, idx, next });
}

if (problems.length) {
  console.log('前置校验未通过,未改任何文件:');
  for (const p of problems) console.log('  ! ' + p);
  process.exit(1);
}

for (const [loc, p] of plan) {
  const before = p.lines[p.idx];
  console.log(`${loc.padEnd(6)} - ${before.trim()}`);
  for (const n of p.next) console.log('       + ' + n.trim());
  if (!DRY) {
    p.lines.splice(p.idx, 1, ...p.next);
    fs.writeFileSync(p.file, p.lines.join('\n'));
  }
}
console.log(`\n共 ${plan.size} 个语言包${DRY ? '(dry-run,未写盘)' : ',已写盘'}`);
