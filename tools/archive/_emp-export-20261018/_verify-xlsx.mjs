/**
 * 独立复核:重新打开导出的 xlsx,打印页签/表头/脱敏样例,并做一遍 PII 残留扫描。
 * 与 _export-emp-xlsx.mjs 的自检互为独立证据(一个在写盘后回读,一个事后另开)。
 *
 * 用法: node tools/archive/_emp-export-20261018/_verify-xlsx.mjs [xlsx 路径]
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('../../../frontend/node_modules/xlsx')

const file = process.argv[2] || fileURLToPath(new URL('../../../db/emp-data-20261018/职员档案-20261018.xlsx', import.meta.url))
const wb = XLSX.readFile(file)
console.log('文件:', file)
console.log('页签:', wb.SheetNames.join(', '))

const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
const panel = sheet('职员')
const all = sheet('全字段')
const doc = sheet('字段说明')

console.log('\n[职员] 表头:', panel[0].join(' | '))
for (const r of panel.slice(1, 6)) console.log('  ' + r.join(' | '))

const phones = panel.slice(1).map((r) => String(r[panel[0].indexOf('手机')] ?? '')).filter(Boolean)
const idNos = panel.slice(1).map((r) => String(r[panel[0].indexOf('证件号码')] ?? '')).filter(Boolean)
console.log('\n非空手机行数:', phones.length, '样例:', [...new Set(phones)].slice(0, 6).join(', '))
console.log('证件号码非空:', idNos.length, '样例:', [...new Set(idNos)].slice(0, 3).join(', '))

console.log('\n[全字段] 行数:', all.length - 1, '列数:', all[0].length)
console.log('[字段说明] 行数:', doc.length - 1)
for (const r of doc.slice(0, 6)) console.log('  ' + r.join(' | '))

// 残留扫描(与导出脚本同规则,带数字边界)
const PII = [/(?<!\d)1[3-9]\d{9}(?!\d)/, /(?<!\d)\d{17}[\dXx](?!\d)/]
let leaks = 0
for (const name of wb.SheetNames) {
  for (const row of sheet(name)) for (const cell of row) {
    const s = String(cell ?? '')
    if (PII.some((re) => re.test(s))) { leaks++; console.log('  [泄漏]', name, s) }
  }
}
console.log(leaks === 0 ? '\n[PASS] PII 残留 0 处' : `\n[FAIL] PII 残留 ${leaks} 处`)
process.exit(leaks === 0 ? 0 : 1)
