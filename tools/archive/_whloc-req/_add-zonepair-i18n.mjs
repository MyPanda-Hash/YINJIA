// 追加 1 条词条(「选择时一起填入」提示)到各语言包 biz 段(2026-10-08)
import fs from 'node:fs'
import path from 'node:path'

const KEY = '选择时会同时填入「大区」和「存储分区」（它们是一个组合）'
const T = {
  en: 'Selecting a row fills both Area and Sub-zone (they form one combination)',
  'zh-TW': '選擇時會同時填入「大區」和「儲存分區」（它們是一個組合）',
  ja: '選択すると「エリア」と「サブゾーン」が同時に入力されます（1つの組み合わせです）',
  de: 'Beim Auswählen werden Bereich und Unterzone gemeinsam eingetragen (sie bilden eine Kombination)',
  es: 'Al seleccionar se rellenan Área y Subzona a la vez (forman una combinación)',
  fr: 'La sélection remplit à la fois la zone fonctionnelle et la sous-zone (elles forment une combinaison)',
  ko: '선택하면 「구역」과 「하위 구역」이 함께 입력됩니다(하나의 조합입니다)',
  ru: 'При выборе заполняются сразу «Зона» и «Подзона» (это одна комбинация)',
  th: 'เมื่อเลือกจะเติมทั้ง «โซน» และ «โซนย่อย» พร้อมกัน (เป็นชุดเดียวกัน)',
  vi: 'Khi chọn sẽ điền đồng thời «Khu» và «Khu con» (chúng là một tổ hợp)',
}
function bizCloseIndex(src) {
  const start = src.search(/\bbiz\s*:\s*\{/)
  if (start < 0) return -1
  let i = src.indexOf('{', start), depth = 0, quote = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) { if (c === '\\') { i++; continue } if (c === quote) quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales'
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const loc = f.replace(/\.js$/, '')
  const abs = path.join(dir, f)
  let src = fs.readFileSync(abs, 'utf8')
  if (src.includes(q(KEY) + ':')) { console.log(`  = ${f} 已有`); continue }
  const at = bizCloseIndex(src)
  if (at < 0) { console.log(`  - ${f} 无 biz 段,跳过`); continue }
  const line = `    ${q(KEY)}: ${q(T[loc] || T.en)},`
  src = src.slice(0, at) + '\n' + line + '\n  ' + src.slice(at)
  fs.writeFileSync(abs, src, 'utf8')
  console.log(`  ✓ ${f}`)
}
