// _i18n-check.mjs — 列出 QcFlowMonitor.vue 里 tt() 的中文词条,并逐语言报缺(只读工具)
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const vue = path.join(root, 'frontend/src/views/modules/qc/QcFlowMonitor.vue')
const src = fs.readFileSync(vue, 'utf8')

// tt('中文') / tt("中文") —— 只取含中文的
const keys = new Set()
const re = /\btt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g
let m
while ((m = re.exec(src))) {
  const k = m[2]
  if (/[\u4e00-\u9fff]/.test(k)) keys.add(k)
}
// 动态 tt(s.name) / tt(row['当前环节']) 之类不在此判定(它们来自后端状态词,单独检查)
const dynamic = ['送料暂收单', '来料检验单', '采购入库单', '送料', '检验', '入库', '完成', '异常',
  '已审核', '草稿', '审批中', '已作废', '已中止', '未生成', '免检', '合格', '不合格', '待检',
  '检验单行', '批号推定', '来源单号']

const all = [...new Set([...keys, ...dynamic])].sort()
const locales = ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

function hasKey(file, key) {
  const text = fs.readFileSync(path.join(root, 'frontend/src/i18n/locales', file), 'utf8')
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // 词条键可能是 '…' 或 "…";值里可能含转义引号
  return new RegExp(`(['"])${esc}\\1\\s*:`).test(text)
}

for (const loc of locales) {
  const file = `${loc}.js`
  const missing = all.filter((k) => !hasKey(file, k))
  console.log(`${loc}: 缺 ${missing.length}` + (missing.length ? ' -> ' + missing.join(' | ') : ''))
}
console.log(`\n共 ${all.length} 条候选词条`)
