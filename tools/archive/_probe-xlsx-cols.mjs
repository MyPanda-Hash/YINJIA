/** 一次性探针:SheetJS(社区版)是否真的把列宽/单元格样式写进 .xlsx(只读验证,写临时文件)。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.resolve('frontend/package.json'))
const XLSX = require('xlsx')
const f = path.join(os.tmpdir(), 'xlsx-cols-probe.xlsx')

const aoa = [['a', 'b', 'c'], ['1', '2', '3']]
const ws = XLSX.utils.aoa_to_sheet(aoa)
ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 30 }]
const cell = ws['A1']
if (cell) cell.s = { font: { bold: true }, alignment: { wrapText: true } }
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'T')
XLSX.writeFile(wb, f, { cellStyles: true })
const back = XLSX.readFile(f)
const ws2 = back.Sheets.T
console.log('cellStyles:true 写回后 !cols =', JSON.stringify(ws2['!cols'] || null))
console.log('cellStyles:true 写回后 A1.s  =', JSON.stringify(ws2.A1?.s || null))
console.log('版本 =', XLSX.version)
console.log('文件留在:', f, '(用解压看 <cols> / styles.xml 才准 —— 读取端不一定会回填 !cols)')
