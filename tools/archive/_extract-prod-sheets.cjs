/**
 * _extract-prod-sheets.cjs — 提取产品文件 Excel 布局(成型工艺清单/配方/检验计划)
 */
const fs = require('fs')
const path = require('node:path')
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const SRC = {
  moldProc: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.成型/工艺清单.xlsx',
  moldFormula: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.成型/配方.xlsx',
  inspPlan: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/3.检验计划表/C-95-23 青岛伊可普20寸折叠复合除铅大胖（出货检验控制计划）.xlsx',
}
for (const [key, file] of Object.entries(SRC)) {
  const wb = XLSX.readFile(file, { cellStyles: true, sheetStubs: true })
  const dump = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const cells = {}
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith('!')) continue
      const c = ws[addr]
      if (c && typeof c.v === 'string' && c.v.trim() !== '') cells[addr] = c.v
      else if (c && c.t === 'n' && c.v != null) cells[addr] = String(c.v)
    }
    if (!Object.keys(cells).length && !(ws['!merges'] || []).length) continue
    dump[name] = {
      ref: ws['!ref'] || 'A1',
      merges: (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m)),
      cols: (ws['!cols'] || []).map((c) => (c && c.wpx ? Math.round(c.wpx) : null)),
      cells,
    }
  }
  const out = path.join(__dirname, '_prod-dump-' + key + '.json')
  fs.writeFileSync(out, JSON.stringify(dump, null, 1), 'utf8')
  console.log('=== ' + key + ' ===')
  for (const [name, d] of Object.entries(dump)) console.log(`  [${name}] ref=${d.ref} merges=${d.merges.length} cells=${Object.keys(d.cells).length}`)
}
