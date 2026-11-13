// 临时校验:确认新增词条在各语言包里的落地情况(只读)
import fs from 'node:fs'
const keys = ['字段视图', '系统整体', '本角色', '本角色定制', '必填', '已定制', '恢复继承', '恢复失败', '本角色字段视图已保存']
for (const loc of ['en', 'ja', 'zh-TW', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']) {
  const lines = fs.readFileSync(`frontend/src/i18n/locales/${loc}.js`, 'utf8').split(/\r?\n/)
  const missing = []
  for (const k of keys) {
    const hit = lines.filter((l) => l.includes(`'${k}'`))
    if (!hit.length) missing.push(k)
  }
  console.log(`${loc}: ${missing.length ? '缺 ' + missing.join('/') : '齐'}`)
}
const en = fs.readFileSync('frontend/src/i18n/locales/en.js', 'utf8').split(/\r?\n/)
for (const k of keys) {
  const hit = en.filter((l) => l.includes(`'${k}'`))
  console.log(`  en ${k} -> ${hit.length ? hit[hit.length - 1].trim() : 'MISSING'}`)
}
