// _add-qc-group-i18n.cjs — 一次性:10 个语言包补 来料品质/制程品质/不良处理/品质追溯 分组词条
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ADD = {
  'zh-TW': { 来料品质: '來料品質', 制程品质: '製程品質', 不良处理: '不良處理', 品质追溯: '品質追溯' },
  en: { 来料品质: 'Incoming Quality', 制程品质: 'Process Quality', 不良处理: 'Defect Handling', 品质追溯: 'Quality Traceability' },
  ja: { 来料品质: '入荷品質', 制程品质: '工程品質', 不良处理: '不良処理', 品质追溯: '品質トレーサビリティ' },
  ko: { 来料品质: '입고 품질', 制程品质: '공정 품질', 不良处理: '불량 처리', 品质追溯: '품질 추적' },
  es: { 来料品质: 'Calidad de entrada', 制程品质: 'Calidad de proceso', 不良处理: 'Gestión de defectos', 品质追溯: 'Trazabilidad de calidad' },
  fr: { 来料品质: 'Qualité réception', 制程品质: 'Qualité processus', 不良处理: 'Traitement des défauts', 品质追溯: 'Traçabilité qualité' },
  de: { 来料品质: 'Eingangsqualität', 制程品质: 'Prozessqualität', 不良处理: 'Fehlerbehandlung', 品质追溯: 'Qualitätsrückverfolgung' },
  ru: { 来料品质: 'Входной контроль качества', 制程品质: 'Качество процессов', 不良处理: 'Обработка брака', 品质追溯: 'Прослеживаемость качества' },
  vi: { 来料品质: 'Chất lượng nguyên liệu đầu vào', 制程品质: 'Chất lượng quá trình', 不良处理: 'Xử lý bất lợi', 品质追溯: 'Truy xuất chất lượng' },
  th: { 来料品质: 'คุณภาพวัสดุรับเข้า', 制程品质: 'คุณภาพกระบวนการ', 不良处理: 'การจัดการของเสีย', 品质追溯: 'การตรวจสอบย้อนกลับคุณภาพ' },
};
for (const [loc, map] of Object.entries(ADD)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let added = 0;
  for (const [key, val] of Object.entries(map)) {
    if (src.includes("'" + key + "':")) continue;
    // 锚点:该文件中「暂收入库单」词条行(上一脚本已插入,必存在)
    const anchor = src.indexOf("'暂收入库单':");
    if (anchor < 0) { console.error(loc + ': 无锚点'); process.exitCode = 1; break; }
    const lineEnd = src.indexOf(eol, anchor);
    src = src.slice(0, lineEnd + eol.length) + "    '" + key + "': '" + val + "'," + eol + src.slice(lineEnd + eol.length);
    added++;
  }
  fs.writeFileSync(file, src);
  console.log(loc + ': 插入 ' + added + ' 词条');
}
