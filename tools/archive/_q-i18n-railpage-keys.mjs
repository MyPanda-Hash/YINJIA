// 一次性工具:把左栏翻页条的两个新词条补进各语言 locales(插在 '下一页' 之后)
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'D:/YINJIA-main/frontend/src/i18n/locales';
const T = {
  'zh-TW': ['第 {p}/{n} 頁', '本頁篩出'],
  ja: ['{p}/{n} ページ', 'このページの絞り込み'],
  ko: ['{p}/{n} 페이지', '이 페이지 필터'],
  de: ['Seite {p} / {n}', 'auf dieser Seite gefiltert'],
  fr: ['Page {p} / {n}', 'filtré sur cette page'],
  es: ['Página {p} / {n}', 'filtrado en esta página'],
  ru: ['Страница {p} / {n}', 'отфильтровано на странице'],
  vi: ['Trang {p} / {n}', 'lọc trên trang này'],
  th: ['หน้า {p} / {n}', 'กรองในหน้านี้'],
};

for (const [loc, [a, b]] of Object.entries(T)) {
  const f = path.join(DIR, loc + '.js');
  let src = fs.readFileSync(f, 'utf8');
  if (src.includes("'第 {p}/{n} 页'")) { console.log(`${loc}: 已存在,跳过`); continue; }
  const m = src.match(/^(\s*)'下一页':.*$/m);
  if (!m) { console.log(`${loc}: 找不到 '下一页' 锚点,跳过`); continue; }
  const ind = m[1];
  const clamp = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const add = `\n${ind}'第 {p}/{n} 页': '${clamp(a)}',\n${ind}'本页筛出': '${clamp(b)}',`;
  src = src.replace(m[0], m[0] + add);
  fs.writeFileSync(f, src, 'utf8');
  console.log(`${loc}: 已插入 2 条`);
}
