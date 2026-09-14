/* 为 9 个语言包插入「选择」词条(锚点:'输入搜索' 行后) */
const fs = require('fs')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'
const T = {
  en: 'Select', ja: '選択', ko: '선택', de: 'Auswählen', es: 'Seleccionar', fr: 'Sélectionner', ru: 'Выбрать', th: 'เลือก', vi: 'Chọn',
}
for (const loc of Object.keys(T)) {
  const f = dir + loc + '.js'
  let s = fs.readFileSync(f, 'utf8')
  if (s.includes("'选择'")) { console.log(loc + ': already has'); continue }
  const re = /('输入搜索': [^\n]*\n)/
  if (!re.test(s)) { console.log(loc + ': anchor not found!'); continue }
  s = s.replace(re, "$1    '选择': '" + T[loc] + "',\n")
  fs.writeFileSync(f, s, 'utf8')
  console.log(loc + ': added')
}
