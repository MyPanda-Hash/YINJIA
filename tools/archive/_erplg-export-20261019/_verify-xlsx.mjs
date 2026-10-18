/**
 * _verify-xlsx.mjs — 独立回读 db/erplg-data-20261019/ERP导入日志-20261019.xlsx(不依赖导出脚本)
 *
 * 用途:Excel 推云端前先自证 —— 页签/行数/表头 + 打前几行真实值,人眼一过就知道内容对不对。
 * 用法: node tools/archive/_erplg-export-20261019/_verify-xlsx.mjs [--file <xlsx>]
 */
import { createRequire } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('../../../frontend/node_modules/xlsx')

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FILE = arg('file', fileURLToPath(new URL('../../../db/erplg-data-20261019/ERP导入日志-20261019.xlsx', import.meta.url)))

if (!existsSync(FILE)) {
  console.error(`[FAIL] 文件不存在: ${FILE}`)
  process.exit(1)
}
console.log(`[文件] ${FILE} (${(statSync(FILE).size / 1024).toFixed(1)} KB)`)

const wb = XLSX.readFile(FILE)
const read = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })
const checks = []
const ck = (ok, what, detail) => { checks.push(ok); console.log(`${ok ? '[PASS]' : '[FAIL]'} ${what}${detail ? ' — ' + detail : ''}`) }

console.log(`[页签] ${wb.SheetNames.join(' / ')}`)
ck(wb.SheetNames.join(',') === 'ERP导入日志,导入明细,字段说明,说明', '四个页签齐全')

const log = read('ERP导入日志')
const row = read('导入明细')
ck(log.length - 1 === 9, '「ERP导入日志」9 行', String(log.length - 1))
ck(row.length - 1 === 45, '「导入明细」45 行', String(row.length - 1))

console.log('\n── 「ERP导入日志」表头 ──')
console.log(log[0].join(' | '))
console.log('\n── 前 3 行 ──')
for (const r of log.slice(1, 4)) console.log(r.map((x) => String(x)).join(' | '))

console.log('\n── 「导入明细」表头 ──')
console.log(row[0].join(' | '))
console.log('\n── 前 3 行 ──')
for (const r of row.slice(1, 4)) console.log(r.map((x) => String(x)).join(' | '))

console.log('\n── 「说明」要点 ──')
for (const r of read('说明')) console.log(r.map((x) => String(x)).join(' | '))

const failed = checks.filter((x) => !x).length
console.log(failed ? `\n❌ ${failed} 项 [FAIL]` : '\n✅ 全部 [PASS]')
process.exit(failed ? 1 : 0)
