// _i18n-pdfsize-keys.cjs — PDF 单页实际尺寸词条(替换旧 desc 引导文案)10 语言(幂等)
const fs = require('node:fs'); const path = require('node:path')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales'
const K = '按纸张实际尺寸单页生成，直接下载，无需打印机'
const E = {
  en: 'Single page at actual sheet size, direct download, no printer needed',
  'zh-TW': '按紙張實際尺寸單頁生成，直接下載，無需打印機',
  ja: '用紙実寸の1ページで生成、直接ダウンロード、プリンター不要',
  ko: '용지 실제 크기 단일 페이지로 생성, 바로 내려받기, 프린터 불필요',
  es: 'Una página al tamaño real de la hoja, descarga directa, sin impresora',
  fr: 'Une page a la taille reelle de la feuille, telechargement direct, sans imprimante',
  de: 'Eine Seite in tatsächlicher Bogengröße, Direktdownload, ohne Drucker',
  ru: 'Одна страница в реальном размере листа, прямое скачивание, принтер не нужен',
  vi: 'Một trang theo kích thước thật của tờ, tải trực tiếp, không cần máy in',
  th: 'หน้าเดียวตามขนาดจริงของกระดาษ ดาวน์โหลดโดยตรง ไม่ต้องมีเครื่องพิมพ์',
}
for (const [loc, v] of Object.entries(E)) {
  const file = path.join(dir, `${loc}.js`)
  let t = fs.readFileSync(file, 'utf8')
  const anchor = t.lastIndexOf('\n  },')
  if (anchor < 0) { console.log(`[${loc}] ANCHOR NOT FOUND`); continue }
  if (!t.includes(`'${K}':`)) {
    t = t.slice(0, anchor + 1) + `    '${K}': '${String(v).replace(/'/g, "\\'")}',\n` + t.slice(anchor + 1)
    fs.writeFileSync(file, t, 'utf8')
    console.log(`[${loc}] +1`)
  } else console.log(`[${loc}] skip`)
}
console.log('done')
