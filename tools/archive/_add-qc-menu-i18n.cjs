// _add-qc-menu-i18n.cjs — 一次性:10 个语言包 biz 区在「来料异常分析报告」锚点后插 3 个来料三单菜单词条
const fs = require('fs');
const path = require('path');
const LOCALES = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales');
const ADD = {
  'zh-TW': ["'暂收入库单': '暫收入庫單',", "'检验单': '檢驗單',", "'暂收退料单': '暫收退料單',"],
  en: ["'暂收入库单': 'Temporary Receipt Inbound',", "'检验单': 'Inspection Sheet',", "'暂收退料单': 'Temporary Receipt Return',"],
  ja: ["'暂收入库单': '仮受入庫伝票',", "'检验单': '検査伝票',", "'暂收退料单': '仮受返品伝票',"],
  ko: ["'暂收入库单': '가수입 입고전표',", "'检验单': '검사전표',", "'暂收退料单': '가수입 반품전표',"],
  es: ["'暂收入库单': 'Entrada temporal de mercancía',", "'检验单': 'Hoja de inspección',", "'暂收退料单': 'Devolución de mercancía temporal',"],
  fr: ["'暂收入库单': 'Réception provisoire',", "'检验单': 'Fiche d\\'inspection',", "'暂收退料单': 'Retour de réception provisoire',"],
  de: ["'暂收入库单': 'Vorläufiger Wareneingang',", "'检验单': 'Prüfschein',", "'暂收退料单': 'Wareneingangs-Rückgabe',"],
  ru: ["'暂收入库单': 'Временная приходная накладная',", "'检验单': 'Лист контроля',", "'暂收退料单': 'Возврат из временного прихода',"],
  vi: ["'暂收入库单': 'Phiếu nhập kho tạm nhận',", "'检验单': 'Phiếu kiểm nghiệm',", "'暂收退料单': 'Phiếu trả hàng tạm nhận',"],
  th: ["'暂收入库单': 'ใบรับเข้าคลังชั่วคราว',", "'检验单': 'ใบตรวจสอบ',", "'暂收退料单': 'ใบคืนสินค้าชั่วคราว',"],
};
const ANCHOR = '来料异常分析报告';
for (const [loc, lines] of Object.entries(ADD)) {
  const file = path.join(LOCALES, loc + '.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes("'暂收入库单':")) { console.log(loc + ': 已有,跳过'); continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const idx = src.indexOf(ANCHOR);
  if (idx < 0) { console.error(loc + ': 未找到锚点!'); process.exitCode = 1; continue; }
  const lineEnd = src.indexOf(eol, idx);
  const insert = lines.map((l) => '    ' + l).join(eol);
  src = src.slice(0, lineEnd + eol.length) + insert + eol + src.slice(lineEnd + eol.length);
  fs.writeFileSync(file, src);
  console.log(loc + ': 插入 3 词条');
}
