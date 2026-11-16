/**
 * _gen-semi-i18n-20261116.mjs — 「半成品·免领」相关新词条写进 10 个语言包
 * 用法(仓库根):node tools/archive/_semi-no-pick-20261116/_gen-semi-i18n-20261116.mjs
 * 锚点:`'生产退料单': '<译名>',` 之后;幂等。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

const T = {
  '半成品·免领': {
    en: 'Semi-finished · no issue', 'zh-TW': '半成品·免領', ja: '半製品・払出不要',
    ko: '반제품 · 출고 불필요', de: 'Halbfabrikat · keine Ausgabe', es: 'Semiterminado · sin retirada',
    fr: 'Semi-fini · pas de sortie', ru: 'Полуфабрикат · без выдачи', th: 'กึ่งสำเร็จรูป · ไม่ต้องเบิก',
    vi: 'Bán thành phẩm · không xuất',
  },
  免领: {
    en: 'No issue', 'zh-TW': '免領', ja: '払出不要', ko: '출고 불필요',
    de: 'Keine Ausgabe', es: 'Sin retirada', fr: 'Pas de sortie',
    ru: 'Без выдачи', th: 'ไม่ต้องเบิก', vi: 'Không xuất',
  },
  '这一行是半成品（编码含 **TB），本厂不入库、不需要领料，直接跳过即可': {
    en: 'This line is a semi-finished item (code contains **TB): it is not warehoused here and needs no picking — just skip it',
    'zh-TW': '這一列是半成品（編碼含 **TB），本廠不入庫、不需要領料，直接跳過即可',
    ja: 'この行は半製品です（コードに **TB を含む）。当工場では入庫せず、払出も不要です。そのままスキップしてください',
    ko: '이 행은 반제품입니다(코드에 **TB 포함). 당사는 입고하지 않으며 출고도 필요 없습니다. 그냥 건너뛰세요',
    de: 'Diese Zeile ist ein Halbfabrikat (Code enthält **TB): wird hier nicht eingelagert und muss nicht entnommen werden – einfach überspringen',
    es: 'Esta línea es un semiterminado (el código contiene **TB): no se almacena aquí ni requiere retirada; simplemente omítala',
    fr: "Cette ligne est un semi-fini (le code contient **TB) : il n'est pas stocké ici et ne nécessite aucun prélèvement — passez simplement",
    ru: 'Эта строка — полуфабрикат (код содержит **TB): здесь не хранится и выдачи не требует — просто пропустите',
    th: 'บรรทัดนี้เป็นกึ่งสำเร็จรูป (รหัสมี **TB) ไม่มีการรับเข้าคลังและไม่ต้องเบิก ข้ามไปได้เลย',
    vi: 'Dòng này là bán thành phẩm (mã có **TB): không nhập kho và không cần xuất, chỉ cần bỏ qua',
  },
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const ANCHOR = /^\s*'生产退料单':\s*'.*',\s*$/m
const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

let total = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  let text = fs.readFileSync(file, 'utf8')
  const lines = []
  for (const [key, map] of Object.entries(T)) {
    const val = map[loc]
    if (!val) throw new Error(`缺译名: ${loc} / ${key}`)
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`^\\s*['"]${esc}['"]\\s*:`, 'm').test(text)) continue
    lines.push(`    ${q(key)}: ${q(val)},`)
  }
  if (!lines.length) { console.log(`[skip] ${loc} 已齐`); continue }
  const m = text.match(ANCHOR)
  if (!m) throw new Error(`${loc}.js 找不到锚点行`)
  const at = m.index + m[0].length
  text = text.slice(0, at) + '\n' + lines.join('\n') + text.slice(at)
  fs.writeFileSync(file, text, 'utf8')
  total += lines.length
  console.log(`[ok] ${loc} +${lines.length}`)
}
console.log(`\n共写入 ${total} 条`)
