import fs from 'node:fs'

/**
 * _i18n-first-insp-export.mjs — 首件检验单「打印预览 / 导出 PDF / 导出当前这张纸」这一轮的显示层词条。
 *
 * 用户口径(2026-10-17):「让当前的 excel 可以导出当前这个报表页面,打印预览也需要实现,导出 pdf 也是」。
 * 新增显示层文案:
 *   ① 打印预览(导出格式框第一项);
 *   ② 预览项说明「在新窗口内打开这张纸的 PDF，可直接打印或另存为 PDF」;
 *   ③ 生成预览时的加载提示「正在生成打印预览…」;
 *   ④ 「导出 Excel」在检验单类面板的说明「导出当前这张纸，版式与纸面一致」。
 * zh-CN 是源语言(源码里就是中文,不在 locales 里);锚点 = 各语言包里的「导出报表」行(该批文书类词条同处一段)。
 */
const BLOCK = {
  '打印预览': {
    'zh-TW': '列印預覽',
    en: 'Print preview',
    ja: '印刷プレビュー',
    ko: '인쇄 미리보기',
    de: 'Druckvorschau',
    es: 'Vista previa de impresión',
    fr: 'Aperçu avant impression',
    ru: 'Предварительный просмотр печати',
    vi: 'Xem trước khi in',
    th: 'ตัวอย่างก่อนพิมพ์',
  },
  '在新窗口内打开这张纸的 PDF，可直接打印或另存为 PDF': {
    'zh-TW': '在新視窗內開啟這張紙的 PDF，可直接列印或另存為 PDF',
    en: 'Open this sheet as a PDF in a new window; print it or save it as PDF',
    ja: 'この用紙の PDF を新しいウィンドウで開きます。そのまま印刷または PDF 保存できます',
    ko: '이 용지를 PDF로 새 창에서 엽니다. 바로 인쇄하거나 PDF로 저장할 수 있습니다',
    de: 'Dieses Blatt als PDF in einem neuen Fenster öffnen; direkt drucken oder als PDF speichern',
    es: 'Abra esta hoja como PDF en una ventana nueva; puede imprimirla o guardarla como PDF',
    fr: 'Ouvrir cette feuille en PDF dans une nouvelle fenêtre ; imprimez-la ou enregistrez-la en PDF',
    ru: 'Открыть этот лист в формате PDF в новом окне; можно сразу распечатать или сохранить в PDF',
    vi: 'Mở tờ này dưới dạng PDF trong cửa sổ mới; in ngay hoặc lưu thành PDF',
    th: 'เปิดแผ่นนี้เป็น PDF ในหน้าต่างใหม่ พิมพ์หรือบันทึกเป็น PDF ได้ทันที',
  },
  '正在生成打印预览…': {
    'zh-TW': '正在產生列印預覽…',
    en: 'Generating print preview…',
    ja: '印刷プレビューを生成しています…',
    ko: '인쇄 미리보기를 생성하는 중…',
    de: 'Druckvorschau wird erstellt…',
    es: 'Generando la vista previa de impresión…',
    fr: 'Génération de l’aperçu avant impression…',
    ru: 'Формирование предварительного просмотра…',
    vi: 'Đang tạo bản xem trước khi in…',
    th: 'กำลังสร้างตัวอย่างก่อนพิมพ์…',
  },
  '导出当前这张纸，版式与纸面一致': {
    'zh-TW': '匯出目前這張紙，版式與紙面一致',
    en: 'Export this sheet, laid out exactly as printed',
    ja: 'この用紙を紙面と同じレイアウトでエクスポート',
    ko: '이 용지를 지면과 동일한 레이아웃으로 내보냅니다',
    de: 'Dieses Blatt exportieren – Layout wie auf dem Papier',
    es: 'Exportar esta hoja con el mismo formato del papel',
    fr: 'Exporter cette feuille, mise en page identique au papier',
    ru: 'Экспорт этого листа с той же вёрсткой, что на бумаге',
    vi: 'Xuất tờ này với bố cục giống bản in',
    th: 'ส่งออกแผ่นนี้โดยจัดวางเหมือนต้นฉบับกระดาษ',
  },
}

/** 该词条是否已在语言包里(⚠ 语言包两种引号风格都有:本段是**单引号**,首件检验那批是双引号) */
const hasKey = (s, k) => new RegExp(`^[ \\t]*(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1[ \\t]*:`, 'm').test(s)

let files = 0
let keys = 0
const LANGS = Object.keys(BLOCK['打印预览'])
for (const loc of LANGS) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const add = Object.entries(BLOCK)
    .filter(([k]) => !hasKey(s, k))
    .map(([k, byLoc]) => `    ${JSON.stringify(k)}: ${JSON.stringify(byLoc[loc])},`)
  if (!add.length) { console.log(`SKIP ${loc}: 已全部存在`); continue }
  // 锚点 = 「导出报表」那一行(该批文书类词条同处一段);⚠ 必须带 m 标志(否则 ^ 只认全串开头)
  const anchorRe = /^[ \t]*['"]导出报表['"][ \t]*:/m
  const m = anchorRe.exec(s)
  if (!m) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  const i = m.index
  s = s.slice(0, i) + add.join('\n') + '\n' + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: +${add.length} 条`)
  files++
  keys += add.length
}
console.log(`\n共 ${files} 个语言包 / ${keys} 条词条`)
