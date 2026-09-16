// _add-slrecv-i18n.cjs — 一次性:10 个语言包 biz 区在「暂收入库单」锚点后插 3 个送料暂收单词条
// (面板菜单名 送料暂收单 + 生单按钮 生成送料暂收单/生成来料检验单)
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ADD = {
  'zh-TW': ["'送料暂收单': '送料暫收單',", "'生成送料暂收单': '生成送料暫收單',", "'生成来料检验单': '生成來料檢驗單',"],
  en: ["'送料暂收单': 'Temporary Material Receipt',", "'生成送料暂收单': 'Generate Temporary Material Receipt',", "'生成来料检验单': 'Generate Incoming Inspection Sheet',"],
  ja: ["'送料暂收单': '材料仮受伝票',", "'生成送料暂收单': '材料仮受伝票生成',", "'生成来料检验单': '受入検査伝票生成',"],
  ko: ["'送料暂收单': '자재 임시수령서',", "'生成送料暂收单': '자재 임시수령서 생성',", "'生成来料检验单': '입고검사 전표 생성',"],
  es: ["'送料暂收单': 'Recepción temporal de material',", "'生成送料暂收单': 'Generar recepción temporal de material',", "'生成来料检验单': 'Generar hoja de inspección de entrada',"],
  fr: ["'送料暂收单': 'Réception temporaire de matière',", "'生成送料暂收单': 'Générer réception temporaire de matière',", "'生成来料检验单': 'Générer fiche d\\'inspection à réception',"],
  de: ["'送料暂收单': 'Vorübergehender Materialeingang',", "'生成送料暂收单': 'Vorübergehenden Materialeingang erzeugen',", "'生成来料检验单': 'Wareneingangsprüfung erzeugen',"],
  ru: ["'送料暂收单': 'Временное получение материала',", "'生成送料暂收单': 'Сгенерировать временное получение',", "'生成来料检验单': 'Сгенерировать лист входного контроля',"],
  vi: ["'送料暂收单': 'Phiếu tạm nhận vật tư',", "'生成送料暂收单': 'Tạo phiếu tạm nhận vật tư',", "'生成来料检验单': 'Tạo phiếu kiểm nghiệm đầu vào',"],
  th: ["'送料暂收单': 'ใบรับวัสดุชั่วคราว',", "'生成送料暂收单': 'สร้างใบรับวัสดุชั่วคราว',", "'生成来料检验单': 'สร้างใบตรวจรับของเข้า',"],
};
const ANCHOR = '暂收入库单';
for (const [loc, lines] of Object.entries(ADD)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes("'送料暂收单':")) { console.log(loc + ': 已有,跳过'); continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const idx = src.indexOf(ANCHOR);
  if (idx < 0) { console.error(loc + ': 未找到锚点!'); process.exitCode = 1; continue; }
  const lineEnd = src.indexOf(eol, idx);
  const insert = lines.map((l) => '    ' + l).join(eol);
  src = src.slice(0, lineEnd + eol.length) + insert + eol + src.slice(lineEnd + eol.length);
  fs.writeFileSync(file, src);
  console.log(loc + ': 插入 3 词条');
}
