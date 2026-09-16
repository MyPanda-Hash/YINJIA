// _add-rail-i18n.cjs — 一次性:10 个语言包 biz 区补 左侧单据选择栏 词条(共有数据/审核状态)
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ADD = {
  'zh-TW': ["'共有数据': '共有資料',", "'审核状态': '審核狀態',"],
  en: ["'共有数据': 'Total records',", "'审核状态': 'Audit Status',"],
  ja: ["'共有数据': '総件数',", "'审核状态': '承認状態',"],
  ko: ["'共有数据': '총 데이터',", "'审核状态': '승인 상태',"],
  es: ["'共有数据': 'Total de registros',", "'审核状态': 'Estado de auditoría',"],
  fr: ["'共有数据': 'Total des données',", "'审核状态': 'Statut de validation',"],
  de: ["'共有数据': 'Gesamtdatensätze',", "'审核状态': 'Prüfstatus',"],
  ru: ["'共有数据': 'Всего записей',", "'审核状态': 'Статус проверки',"],
  vi: ["'共有数据': 'Tổng số dữ liệu',", "'审核状态': 'Trạng thái duyệt',"],
  th: ["'共有数据': 'ข้อมูลทั้งหมด',", "'审核状态': 'สถานะตรวจสอบ',"],
};
const ANCHOR = '输入搜索';
for (const [loc, lines] of Object.entries(ADD)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes("'共有数据':")) { console.log(loc + ': 已有,跳过'); continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const idx = src.indexOf(ANCHOR);
  if (idx < 0) { console.error(loc + ': 未找到锚点!'); process.exitCode = 1; continue; }
  const lineEnd = src.indexOf(eol, idx);
  const insert = lines.map((l) => '    ' + l).join(eol);
  src = src.slice(0, lineEnd + eol.length) + insert + eol + src.slice(lineEnd + eol.length);
  fs.writeFileSync(file, src);
  console.log(loc + ': 插入 2 词条');
}
