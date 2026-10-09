// 仓位 → 库位 批量替换(2026-10-08 回退)
// 前提:已核实 frontend/src 与 backend 源码里的 73 处「仓位」全部属于 WHLOC/WH 这一套(金蝶字段只在 DB 元数据里)。
import fs from 'node:fs'
import path from 'node:path'

const files = [
  'frontend/src/business/menus.js',
  'frontend/src/business/print-formats.js',
  'frontend/src/business/print-formats.test.js',
  'frontend/src/core/views/PanelxList.vue',
  'backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java',
]
const locDir = 'frontend/src/i18n/locales'
for (const f of fs.readdirSync(locDir)) if (f.endsWith('.js')) files.push(locDir + '/' + f)

let changed = 0
const report = []
for (const rel of files) {
  const abs = path.join('D:/workspace/yinjia', rel)
  const before = fs.readFileSync(abs, 'utf8')
  let after = before.split('仓位').join('库位')
  if (rel.endsWith('zh-TW.js')) after = after.split('倉位').join('庫位')
  if (after !== before) {
    fs.writeFileSync(abs, after, 'utf8')
    const n = (before.match(/仓位/g) || []).length + (rel.endsWith('zh-TW.js') ? (before.match(/倉位/g) || []).length : 0)
    report.push(`  ${rel.padEnd(52)} ${n} 处`)
    changed++
  }
}
console.log('已替换文件:'); console.log(report.join('\n'))
console.log(`\n共 ${changed} 个文件`)
// 复查残留
let left = 0
for (const rel of files) {
  const t = fs.readFileSync(path.join('D:/workspace/yinjia', rel), 'utf8')
  const n = (t.match(/仓位/g) || []).length + (rel.endsWith('zh-TW.js') ? (t.match(/倉位/g) || []).length : 0)
  if (n) { console.log(`  ⚠ 残留 ${rel}: ${n}`); left += n }
}
console.log(left ? `残留合计 ${left}` : '✓ 零残留')
