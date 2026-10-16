/**
 * _dump-xlsx.mjs — 把导出的 .xlsx 读回二维数组打印,核对"纸面形状"导出是否成形。
 * 用法:node tools/archive/_dump-xlsx.mjs <xlsx 路径>
 * 只读:不写文件、不改数据。
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(path.resolve('frontend/package.json'))
const XLSX = require('xlsx')

const file = process.argv[2]
if (!file || !fs.existsSync(file)) { console.log('用法:node tools/archive/_dump-xlsx.mjs <xlsx路径>'); process.exit(2) }
const wb = XLSX.readFile(file)
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
console.log(`[sheet] ${wb.SheetNames[0]}  行数=${aoa.length}  列数=${ws['!ref']}`)
console.log(`[cols]  ${JSON.stringify(ws['!cols'] || null)}`)
console.log(`[merges] ${(ws['!merges'] || []).length} 处:` +
  (ws['!merges'] || []).slice(0, 12).map((m) => `r${m.s.r}c${m.s.c}-r${m.e.r}c${m.e.c}`).join(' '))
aoa.forEach((row, i) => {
  const cells = row.map((v) => String(v ?? '').replace(/\s+/g, ' ').slice(0, 26))
  console.log(String(i).padStart(2) + ' | ' + cells.join(' | ').slice(0, 240))
})
