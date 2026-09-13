// _i18n-pdfdirect-keys.cjs — PDF 直接导出 3 词条补进 10 语言包(幂等)
const fs = require('node:fs'); const path = require('node:path')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales'
const K = ['直接生成 PDF 文件下载，无需打印机', '正在生成 PDF…', '未找到可导出的单据']
const E = {
  en: ['Directly generates a PDF file download - no printer needed', 'Generating PDF...', 'No exportable document found'],
  'zh-TW': ['直接生成 PDF 文件下載，無需打印機', '正在生成 PDF…', '未找到可導出的單據'],
  ja: ['プリンター不要で PDF ファイルを直接ダウンロード生成します', 'PDF 生成中…', 'エクスポートできる伝票がありません'],
  ko: ['프린터 없이 PDF 파일을 바로 생성해 내려받습니다', 'PDF 생성 중…', '내보낼 수 있는 전표가 없습니다'],
  es: ['Genera directamente un archivo PDF - sin impresora', 'Generando PDF...', 'No hay documento para exportar'],
  fr: ["Genere directement un fichier PDF - sans imprimante", 'Generation du PDF...', 'Aucun document a exporter'],
  de: ['Erzeugt die PDF-Datei direkt - ohne Drucker', 'PDF wird erstellt…', 'Kein exportierbares Dokument gefunden'],
  ru: ['Создаёт файл PDF напрямую - принтер не нужен', 'Генерация PDF…', 'Нет документа для экспорта'],
  vi: ['Tạo trực tiếp tệp PDF - không cần máy in', 'Đang tạo PDF…', 'Không tìm thấy chứng từ để xuất'],
  th: ['สร้างไฟล์ PDF โดยตรง ไม่ต้องมีเครื่องพิมพ์', 'กำลังสร้าง PDF…', 'ไม่พบเอกสารที่จะส่งออก'],
}
for (const [loc, vals] of Object.entries(E)) {
  const file = path.join(dir, `${loc}.js`)
  let t = fs.readFileSync(file, 'utf8')
  const anchor = t.lastIndexOf('\n  },')
  if (anchor < 0) { console.log(`[${loc}] ANCHOR NOT FOUND`); continue }
  const lines = []
  K.forEach((k, i) => { if (!t.includes(`'${k}':`)) lines.push(`    '${k}': '${String(vals[i]).replace(/'/g, "\\'")}',`) })
  if (lines.length) { t = t.slice(0, anchor + 1) + lines.join('\n') + '\n' + t.slice(anchor + 1); fs.writeFileSync(file, t, 'utf8') }
  console.log(`[${loc}] +${lines.length}`)
}
console.log('done')
