// _docx-i18n-merge.cjs — Word 预览降级提示词条一次性合入 10 语言包(2026-09-17)
const fs = require('fs')
const dir = 'frontend/src/i18n/locales'
const KEY = '该文件无法在线预览，已转为下载'
const tr = {
  en: 'This file cannot be previewed online; it has been downloaded instead',
  ja: 'このファイルはオンラインでプレビューできないため、ダウンロードしました',
  ko: '이 파일은 온라인 미리보기가 불가하여 다운로드로 전환했습니다',
  es: 'Este archivo no se puede previsualizar en línea; se ha descargado',
  fr: 'Ce fichier ne peut pas être prévisualisé en ligne; il a été téléchargé',
  de: 'Diese Datei kann nicht online angezeigt werden; sie wurde heruntergeladen',
  ru: 'Этот файл нельзя просмотреть онлайн; он загружен для скачивания',
  vi: 'Tệp này không thể xem trước trực tuyến, đã chuyển sang tải xuống',
  th: 'ไฟล์นี้ไม่สามารถดูตัวอย่างออนไลน์ได้ จึงเปลี่ยนเป็นดาวน์โหลดแล้ว',
  'zh-TW': '該檔案無法線上預覽，已轉為下載',
}
const out = []
for (const [loc, v] of Object.entries(tr)) {
  const f = `${dir}/${loc}.js`
  let s = fs.readFileSync(f, 'utf8')
  if (s.includes(`'${KEY}'`)) { out.push(`${loc}:已有`); continue }
  const at = s.indexOf('  biz: {')
  if (at < 0) { out.push(`${loc}:无biz`); continue }
  const ins = `\r\n    '${KEY}': '${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`
  s = s.slice(0, at + 8) + ins + s.slice(at + 8)
  fs.writeFileSync(f, s, 'utf8')
  out.push(`${loc}:+1`)
}
console.log(out.join(' '))
