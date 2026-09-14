/**
 * _extract-lab-sheets.cjs — 提取实验室 4 表布局并分别落盘
 * 输出: tools/_lab-dump-<key>.json + 控制台布局摘要
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const SRC = {
  spike: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/3.实验室使用记录表/加标水配置记录表.xlsx',
  domtest: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/3.实验室使用记录表/内部委托测试申请单.xlsx',
  equip: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/3.实验室使用记录表/设备使用登记表.xlsx',
  instr: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/3.实验室使用记录表/仪器使用记录表.xls',
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
      else if (c && (c.t === 'n') && c.v !== undefined && c.v !== null) cells[addr] = String(c.v)
    }
    if (!Object.keys(cells).length && !(ws['!merges'] || []).length) continue
    dump[name] = {
      ref: ws['!ref'] || 'A1',
      merges: (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m)),
      cols: (ws['!cols'] || []).map((c) => (c && c.wpx ? Math.round(c.wpx) : null)),
      rows: Object.fromEntries(Object.entries(ws['!rows'] || {}).map(([i, r]) => [i, r && r.hpx ? Math.round(r.hpx) : null])),
      cells,
    }
  }
  const out = path.join(__dirname, '_lab-dump-' + key + '.json')
  fs.writeFileSync(out, JSON.stringify(dump, null, 1), 'utf8')
  console.log('=== ' + key + ' -> ' + path.basename(out) + ' ===')
  for (const [name, d] of Object.entries(dump)) {
    console.log(`  [${name}] ref=${d.ref} merges=${d.merges.length} cells=${Object.keys(d.cells).length}`)
  }
}
