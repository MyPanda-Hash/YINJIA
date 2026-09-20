// 一次性工具:把模糊搜索"清单截断"提示的两个新词条补进各语言 locales(插在 '张单据' 之后)
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'D:/YINJIA-main/frontend/src/i18n/locales';
const T = {
  'zh-TW': ['找到 {n} 張單據，清單僅列出前 {m} 張', '（清單僅顯示前 {m} 張）'],
  ja: ['検索結果 {n} 枚、一覧は先頭 {m} 件のみ表示', '（一覧は先頭 {m} 件のみ表示）'],
  ko: ['{n}건의 전표를 찾았습니다. 목록은 처음 {m}건만 표시합니다', '（목록은 처음 {m}건만 표시）'],
  de: ['{n} Belege gefunden; die Liste zeigt nur die ersten {m}', '（Liste zeigt nur die ersten {m}）'],
  fr: ['{n} documents trouvés ; la liste affiche seulement les {m} premiers', '（la liste affiche seulement les {m} premiers）'],
  es: ['Se encontraron {n} documentos; la lista solo muestra los primeros {m}', '（la lista solo muestra los primeros {m}）'],
  ru: ['Найдено {n} документов; в списке только первые {m}', '（в списке только первые {m}）'],
  vi: ['Tìm thấy {n} chứng từ; danh sách chỉ hiển thị {m} đầu tiên', '（danh sách chỉ hiển thị {m} đầu tiên）'],
  th: ['พบ {n} เอกสาร รายการแสดงเฉพาะ {m} รายการแรก', '（รายการแสดงเฉพาะ {m} รายการแรก）'],
};

for (const [loc, [a, b]] of Object.entries(T)) {
  const f = path.join(DIR, loc + '.js');
  let src = fs.readFileSync(f, 'utf8');
  if (src.includes('找到 {n} 张单据')) { console.log(`${loc}: 已存在,跳过`); continue; }
  const m = src.match(/^(\s*)'张单据':.*$/m);
  if (!m) { console.log(`${loc}: 找不到 '张单据' 锚点,跳过`); continue; }
  const ind = m[1];
  const clamp = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const add = `\n${ind}'找到 {n} 张单据，清单仅列出前 {m} 张': '${clamp(a)}',\n${ind}'（清单仅显示前 {m} 张）': '${clamp(b)}',`;
  src = src.replace(m[0], m[0] + add);
  fs.writeFileSync(f, src, 'utf8');
  console.log(`${loc}: 已插入 2 条`);
}
