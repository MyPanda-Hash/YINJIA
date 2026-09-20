// _add-done-i18n.cjs — 一次性:给 9 个语言包补「已完成」词条(方案 A 新增状态,en 已有 'Done')
// 与既有 _add-rail-i18n.cjs 同做法:锚点行后插入,幂等(已存在即跳过),保留原换行风格
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ANCHOR = "'已中止':";
const ADD = {
  'zh-TW': "'已完成': '已完成',",
  ja: "'已完成': '完了',",
  ko: "'已完成': '완료',",
  de: "'已完成': 'Abgeschlossen',",
  es: "'已完成': 'Completado',",
  fr: "'已完成': 'Terminé',",
  ru: "'已完成': 'Завершено',",
  th: "'已完成': 'เสร็จสิ้น',",
  vi: "'已完成': 'Đã hoàn thành',",
};
let changed = 0;
for (const [loc, line] of Object.entries(ADD)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes("'已完成':")) { console.log(loc + ': 已有,跳过'); continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const idx = src.indexOf(ANCHOR);
  if (idx < 0) { console.error(loc + ': 未找到锚点 ' + ANCHOR); process.exitCode = 1; continue; }
  const lineEnd = src.indexOf(eol, idx);
  if (lineEnd < 0) { console.error(loc + ': 锚点行无行尾'); process.exitCode = 1; continue; }
  src = src.slice(0, lineEnd + eol.length) + '    ' + line + eol + src.slice(lineEnd + eol.length);
  fs.writeFileSync(file, src);
  console.log(loc + ': 已插入');
  changed++;
}
console.log(`共修改 ${changed} 个语言包`);
