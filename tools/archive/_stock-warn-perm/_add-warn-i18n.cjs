/**
 * _add-warn-i18n.cjs — 「预警配置」(组织架构·角色与面板权限矩阵的新权限列,权限词 warn)词条(10 语言)
 *
 * 背景:库存预警数量配置权 2026-10-15 从「修改」词里独立成 warn 词,权限矩阵列头由
 * SysAdminController.PERMISSION_ACTIONS 下发,前端 OrgAdmin.vue 用 tt(act[1]) 渲染 ⇒
 * 中文标签「预警配置」必须进 locales 的 biz 词表,否则切到英语显示中文。
 *
 * 用法:node tools/archive/_stock-warn-perm/_add-warn-i18n.cjs
 * 幂等:已存在 '预警配置': 行则跳过该语言;锚点 = '库存明细': 行之后(与月结词条插入位置一致)。
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = ['预警配置']
const TEXT = {
  en: ['Warning Config'],
  ja: ['アラーム設定'],
  ko: ['경고 설정'],
  'zh-TW': ['預警配置'],
  es: ['Configuración de avisos'],
  fr: ['Configuration des alertes'],
  de: ['Warnkonfiguration'],
  ru: ['Настройка предупреждений'],
  vi: ['Cấu hình cảnh báo'],
  th: ['ตั้งค่าการแจ้งเตือน'],
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数不一致`)
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const missing = KEYS.filter((k, i) => !lines.some((l) => l.includes(`'${k}':`)) && texts[i])
  if (!missing.length) { console.log(`[skip] ${loc}.js 已齐`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const added = KEYS.map((k, i) => (missing.includes(k) ? `${indent}'${k}': '${String(texts[i]).replace(/'/g, "\\'")}',` : null)).filter(Boolean)
  lines.splice(anchor + 1, 0, ...added)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js +${added.length}`)
}
console.log(`完成:${touched}`)
