// _drop-qcrecv-i18n2.cjs — 一次性:10 个语言包删除孤立按钮词条「选暂收入库单」(按钮已改为 选送料暂收单)
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
for (const loc of ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const out = src.split(/\r?\n/).filter((l) => !/^\s*['"]选暂收入库单['"]\s*:/.test(l)).join(eol);
  if (out === src) { console.log(loc + ': 无词条,跳过'); continue; }
  fs.writeFileSync(file, out);
  console.log(loc + ': 删除 1 词条');
}
