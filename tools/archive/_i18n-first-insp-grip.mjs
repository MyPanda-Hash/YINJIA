import fs from 'node:fs'

/**
 * _i18n-first-insp-grip.mjs — 首件检验单「标准行拖动下标」这一轮的显示层词条(2026-10-17 第七轮)。
 *
 * 用户口径(截图红框=标准行「炭棒长度」格里的拖动抓手):
 *   「这个拖动下标应该跟着当前的这个表格框的右下角走」。
 *
 * 本批新增的**显示层**文案只有一条(抓手悬停提示):
 *   「拖动调整「标准」行的行高」。
 * zh-CN 是源语言(源码里就是中文,不在 locales 里);锚点 = 各语言包首件检验那批的「已按成型工艺清单」行。
 */
const KEY = '拖动调整「标准」行的行高'

const TRANSLATIONS = {
  'zh-TW': '拖動調整「標準」行的行高',
  en: 'Drag to adjust the height of the "Standard" row',
  ja: 'ドラッグして「標準」行の行高を調整',
  ko: '드래그하여 「표준」 행의 높이를 조정',
  de: 'Ziehen, um die Höhe der Zeile „Standard“ anzupassen',
  es: 'Arrastre para ajustar la altura de la fila «Estándar»',
  fr: 'Faites glisser pour ajuster la hauteur de la ligne « Standard »',
  ru: 'Перетащите, чтобы изменить высоту строки «Стандарт»',
  vi: 'Kéo để điều chỉnh chiều cao hàng 「Tiêu chuẩn」',
  th: 'ลากเพื่อปรับความสูงของแถว 「มาตรฐาน」',
}

let files = 0
for (const [loc, text] of Object.entries(TRANSLATIONS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes(`${JSON.stringify(KEY)}:`)) { console.log(`SKIP ${loc}: 已存在`); continue }
  const anchor = '    "已按成型工艺清单":'
  const i = s.indexOf(anchor)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  s = s.slice(0, i) + `    ${JSON.stringify(KEY)}: ${JSON.stringify(text)},\n` + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: +1 条`)
  files++
}
console.log(`\n共 ${files} 个语言包`)
