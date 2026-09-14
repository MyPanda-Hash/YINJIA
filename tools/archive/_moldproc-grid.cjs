/**
 * _moldproc-grid.cjs — 程序化还原《工艺清单.xlsx》逐行网格(合并展开)
 * 输出:每行每格的文字与跨度,即真实版式地图
 */
const XLSX = require('C:/INCER/YINJIA-MES/frontend/node_modules/xlsx')
const fs = require('fs')

const wb = XLSX.readFile('C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.成型/工艺清单.xlsx', { sheetStubs: true })
const ws = wb.Sheets['Sheet1']
const range = XLSX.utils.decode_range(ws['!ref'])
const merges = (ws['!merges'] || []).map((m) => ({ ...m, text: '' }))
// 把合并格的主值回填
for (const addr of Object.keys(ws)) {
  if (addr.startsWith('!')) continue
  const cell = ws[addr]
  const decoded = XLSX.utils.decode_cell(addr)
  for (const mg of merges) {
    if (decoded.r === mg.s.r && decoded.c === mg.s.c) mg.text = cell.v != null ? String(cell.v) : ''
  }
}
const inMerge = (r, c) => merges.find((m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
const mergeStart = (r, c) => merges.find((m) => m.s.r === r && m.s.c === c)

for (let r = range.s.r; r <= Math.min(range.e.r, 40); r++) {
  const parts = []
  for (let c = 0; c <= 10; c++) {
    const m = mergeStart(r, c)
    if (m) {
      const text = m.text.trim().replace(/\r?\n/g, '⏎')
      const rs = m.e.r - m.s.r + 1
      const cs = m.e.c - m.s.c + 1
      parts.push((text || '·') + (rs > 1 ? `^${rs}` : '') + (cs > 1 ? `>${cs}` : ''))
    } else if (inMerge(r, c)) {
      parts.push('〃') // 被上方合并覆盖
    } else {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      parts.push(cell && cell.v != null ? String(cell.v).trim().replace(/\r?\n/g, '⏎') : '')
    }
  }
  if (parts.some((p) => p && p !== '〃')) console.log(`R${r + 1}: ` + parts.map((p) => '[' + p.slice(0, 22) + ']').join(''))
}
