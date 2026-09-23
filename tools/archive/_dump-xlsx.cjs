/**
 * _dump-xlsx.cjs — 把设计 xlsx 逐 sheet 逐格 dump 出来(含合并单元格/行列号)
 *
 * 为什么不用 PowerShell + COM:走 Excel COM 要装 Excel、且中文经 PS 命令行会乱码。
 * xlsx 库已在 frontend/node_modules(前端导出用),直接借。
 *
 * 用法:node tools/archive/_dump-xlsx.cjs "<xlsx路径>"
 */
'use strict'
const path = require('node:path')
const XLSX = require(path.join('C:\\INCER\\YINJIA-MES', 'frontend', 'node_modules', 'xlsx'))

const file = process.argv[2]
if (!file) { console.error('用法:node _dump-xlsx.cjs <xlsx>'); process.exit(1) }

const wb = XLSX.readFile(file, { cellStyles: true, cellDates: true })
console.log('sheet 列表 =', JSON.stringify(wb.SheetNames))

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  console.log('\n' + '='.repeat(78))
  console.log(`SHEET: ${name}`)
  console.log('='.repeat(78))

  // !ref 是整个用到的范围;!merges 是合并区
  console.log('范围 =', ws['!ref'])
  const merges = ws['!merges'] || []
  console.log('合并区数 =', merges.length)
  if (merges.length) {
    console.log('合并区:')
    for (const m of merges) {
      const r = XLSX.utils.encode_range(m)
      const tl = XLSX.utils.encode_cell(m.s)
      const v = ws[tl] ? ws[tl].v : ''
      console.log(`  ${r}   左上值 = ${JSON.stringify(v)}`)
    }
  }

  // 逐格(不跳过空格,便于看清版式位置)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  console.log('\n格子内容(仅非空):')
  for (let R = range.s.r; R <= range.e.r; R++) {
    const rowOut = []
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (!cell || cell.v === undefined || cell.v === '') continue
      rowOut.push(`${addr}=${JSON.stringify(cell.v)}`)
    }
    if (rowOut.length) console.log(`  [行${R + 1}] ` + rowOut.join('  '))
  }

  // 列宽 / 行高(版式线索)
  if (ws['!cols']) console.log('\n列宽 =', JSON.stringify(ws['!cols'].map((c) => (c ? c.wch : null))))
  if (ws['!rows']) console.log('行高 =', JSON.stringify(ws['!rows'].map((r) => (r ? r.hpt : null))))
}
