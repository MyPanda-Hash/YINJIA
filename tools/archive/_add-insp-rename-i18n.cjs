// _add-insp-rename-i18n.cjs — 一次性:10 个语言包把「检验单」词条原地改为「来料检验单」,
// 并新增「选暂收入库单」按钮词条(QC_INSP 选单按钮随改名换标签)
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const RENAME = {
  'zh-TW': ['來料檢驗單', '選暫收入庫單'],
  en: ['Incoming Inspection Sheet', 'Select temporary receipt inbound'],
  ja: ['受入検査伝票', '仮受入庫伝票を選択'],
  ko: ['입고검사 전표', '가수입 입고전표 선택'],
  es: ['Hoja de inspección de entrada', 'Seleccionar entrada temporal'],
  fr: ["Fiche d'inspection à réception", 'Sélectionner réception provisoire'],
  de: ['Wareneingangsprüfung', 'Vorläufigen Wareneingang wählen'],
  ru: ['Лист входного контроля', 'Выбрать временную приходную накладную'],
  vi: ['Phiếu kiểm nghiệm đầu vào', 'Chọn phiếu nhập kho tạm nhận'],
  th: ['ใบตรวจรับของเข้า', 'เลือกใบรับเข้าชั่วคราว'],
};
for (const [loc, [newName, selectLbl]] of Object.entries(RENAME)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const esc = (s) => s.replace(/'/g, "\\'"); // fr 译名含撇号,目标文件是单引号串
  const m = src.match(/^(\s*)'检验单': '.*?',\r?\n/m); // fr 值内含转义撇号 d\'inspection,用非贪婪整行匹配
  if (src.includes("'来料检验单':")) { console.log(loc + ': 已改,跳过'); continue; }
  if (m) {
    src = src.replace(/^(\s*)'检验单': '.*?',\r?\n/m, `$1'来料检验单': '${esc(newName)}',${eol}`);
  } else {
    console.error(loc + ': 未找到 检验单 词条!');
    process.exitCode = 1;
    continue;
  }
  if (!src.includes("'选暂收入库单':")) {
    const idx = src.indexOf("'来料检验单':");
    const lineEnd = src.indexOf(eol, idx);
    src = src.slice(0, lineEnd + eol.length) + `    '选暂收入库单': '${esc(selectLbl)}',` + eol + src.slice(lineEnd + eol.length);
  }
  fs.writeFileSync(file, src);
  console.log(loc + ': 检验单→来料检验单 + 选暂收入库单');
}
