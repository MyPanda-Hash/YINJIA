// _i18n-exportfmt-keys.cjs — 导出格式选择 8 词条补进 10 语言包(幂等;JS 转义 \')
const fs = require('node:fs'); const path = require('node:path')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales'
const K = ['选择导出格式', '导出 PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”', '导出 Excel（.xlsx）', '头字段键值 + 各明细页签全字段全数据，不受纸张限制', '已导出', '导出失败', '行']
const entries = {
  en: { '选择导出格式': 'Choose Export Format', '导出 PDF': 'Export PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'Opens the print dialog - choose "Save as PDF" as the destination', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'PDF export opens the print dialog. Choose "Save as PDF" as the printer destination.', '导出 Excel（.xlsx）': 'Export Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'Header key-values + all detail tabs with full fields and data, not limited by paper layout', '已导出': 'Exported', '导出失败': 'Export failed', '行': 'rows' },
  'zh-TW': { '选择导出格式': '選擇導出格式', '导出 PDF': '導出 PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': '打開打印對話框，在“目標打印機”處選擇“另存為 PDF”', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'PDF 導出將打開打印對話框，請在“目標打印機”處選擇“另存為 PDF”', '导出 Excel（.xlsx）': '導出 Excel（.xlsx）', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': '頭字段鍵值 + 各明細頁簽全字段全數據，不受紙張限制', '已导出': '已導出', '导出失败': '導出失敗', '行': '行' },
  ja: { '选择导出格式': 'エクスポート形式を選択', '导出 PDF': 'PDF でエクスポート', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': '印刷ダイアログの「プリンター」で「PDF として保存」を選択してください', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'PDF エクスポートは印刷ダイアログを開きます。プリンターで「PDF として保存」を選択してください。', '导出 Excel（.xlsx）': 'Excel(.xlsx)でエクスポート', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'ヘッダー項目 + 全明細タブの全項目・全データを用紙制限なしで出力', '已导出': 'エクスポートしました', '导出失败': 'エクスポート失敗', '行': '行' },
  ko: { '选择导出格式': '내보내기 형식 선택', '导出 PDF': 'PDF 내보내기', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': '인쇄 대화상자의 «프린터»에서 «PDF로 저장»을 선택하세요', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'PDF 내보내기는 인쇄 대화상자를 엽니다. 프린터에서 «PDF로 저장»을 선택하세요.', '导出 Excel（.xlsx）': 'Excel(.xlsx) 내보내기', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': '헤더 항목 + 전체 명세 탭의 전체 필드·데이터를 용지 제한 없이 내보냅니다', '已导出': '내보냈습니다', '导出失败': '내보내기 실패', '行': '행' },
  es: { '选择导出格式': 'Elegir formato de exportación', '导出 PDF': 'Exportar PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'Abre el dialogo de impresion: elija "Guardar como PDF" como destino', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'La exportacion PDF abre el dialogo de impresion. Elija "Guardar como PDF".', '导出 Excel（.xlsx）': 'Exportar Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'Campos de cabecera + todas las pestanas de detalle con todos los campos y datos', '已导出': 'Exportado', '导出失败': 'Error al exportar', '行': 'filas' },
  fr: { '选择导出格式': "Choisir le format d'export", '导出 PDF': 'Exporter en PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': "Ouvre la boite d'impression - choisissez « Enregistrer au format PDF »", 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': "L'export PDF ouvre la boite d'impression. Choisissez « Enregistrer au format PDF ».", '导出 Excel（.xlsx）': 'Exporter Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': "Valeurs d'enete + tous les onglets de detail, champs et donnees complets", '已导出': 'Exporté', '导出失败': "Échec de l'export", '行': 'lignes' },
  de: { '选择导出格式': 'Exportformat wählen', '导出 PDF': 'Als PDF exportieren', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'Öffnet den Druckdialog - als Ziel „Als PDF speichern“ wählen', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'Der PDF-Export öffnet den Druckdialog. Wählen Sie „Als PDF speichern“.', '导出 Excel（.xlsx）': 'Als Excel (.xlsx) exportieren', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'Kopffelder + alle Detailtabs mit vollständigen Feldern und Daten', '已导出': 'Exportiert', '导出失败': 'Export fehlgeschlagen', '行': 'Zeilen' },
  ru: { '选择导出格式': 'Выбор формата экспорта', '导出 PDF': 'Экспорт в PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'Откроется диалог печати - выберите «Сохранить как PDF»', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'Экспорт PDF открывает диалог печати. Выберите «Сохранить как PDF».', '导出 Excel（.xlsx）': 'Экспорт в Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'Поля шапки + все вкладки деталей с полными полями и данными', '已导出': 'Экспортировано', '导出失败': 'Ошибка экспорта', '行': 'строк' },
  vi: { '选择导出格式': 'Chọn định dạng xuất', '导出 PDF': 'Xuất PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'Mở hộp thoại in - chọn «Lưu dưới dạng PDF»', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'Xuất PDF sẽ mở hộp thoại in. Hãy chọn «Lưu dưới dạng PDF».', '导出 Excel（.xlsx）': 'Xuất Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'Trường đầu + các tab chi tiết đầy đủ trường và dữ liệu', '已导出': 'Đã xuất', '导出失败': 'Xuất thất bại', '行': 'dòng' },
  th: { '选择导出格式': 'เลือกรูปแบบส่งออก', '导出 PDF': 'ส่งออก PDF', '打开打印对话框，在“目标打印机”处选择“另存为 PDF”': 'เปิดกล่องโต้ตอบการพิมพ์ - เลือก «บันทึกเป็น PDF»', 'PDF 导出将打开打印对话框，请在“目标打印机”处选择“另存为 PDF”': 'การส่งออก PDF จะเปิดกล่องโต้ตอบการพิมพ์ โปรดเลือก «บันทึกเป็น PDF»', '导出 Excel（.xlsx）': 'ส่งออก Excel (.xlsx)', '头字段键值 + 各明细页签全字段全数据，不受纸张限制': 'ฟิลด์หัว + ทุกแท็บรายละเอียดพร้อมฟิลด์และข้อมูลครบ ไม่จำกัดตามกระดาษ', '已导出': 'ส่งออกแล้ว', '导出失败': 'ส่งออกล้มเหลว', '行': 'แถว' },
}
for (const [loc, dict] of Object.entries(entries)) {
  const file = path.join(dir, `${loc}.js`)
  let text = fs.readFileSync(file, 'utf8')
  const anchor = text.lastIndexOf('\n  },')
  if (anchor < 0) { console.log(`[${loc}] ANCHOR NOT FOUND`); continue }
  const lines = []
  for (const k of K) {
    if (text.includes(`'${k}':`)) continue
    const v = dict[k]
    if (v === undefined) continue
    lines.push(`    '${k}': '${String(v).replace(/'/g, "\\'")}',`)
  }
  if (lines.length) {
    text = text.slice(0, anchor + 1) + lines.join('\n') + '\n' + text.slice(anchor + 1)
    fs.writeFileSync(file, text, 'utf8')
  }
  console.log(`[${loc}] +${lines.length} keys`)
}
console.log('done')
