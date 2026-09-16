// _drop-qcrecv-i18n.cjs — 一次性:10 个语言包删除「暂收入库单」词条(面板已下线)
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
for (const loc of ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.split(/\r?\n/).filter((l) => !/^\s*['"]暂收入库单['"]\s*:/.test(l)).join(src.includes('\r\n') ? '\r\n' : '\n');
  if (src === before) { console.log(loc + ': 无词条,跳过'); continue; }
  fs.writeFileSync(file, src);
  console.log(loc + ': 删除 1 词条');
}
