#!/usr/bin/env node
/**
 * _extract-record-sheets.cjs — 解析《04数据记录表.xlsx》全部工作表布局(任务工具)
 * 输出: tools/_record-sheets-dump.json  (cells/merges/cols/rows/charts/controls)
 * 用法: node tools/_extract-record-sheets.cjs <xlsx路径>
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const xlsxPath = process.argv[2]
if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error('usage: node _extract-record-sheets.cjs <xlsx>')
  process.exit(1)
}

const wb = XLSX.readFile(xlsxPath, { cellStyles: true, sheetStubs: true })
const dump = {}

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const ref = ws['!ref'] || 'A1'
  const cells = {}
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const c = ws[addr]
    if (c && c.t === 's' && typeof c.v === 'string' && c.v.trim() !== '') cells[addr] = c.v
    else if (c && c.t === 'str' && c.v) cells[addr] = c.v
    else if (c && (c.t === 'n' || c.t === 'b') && c.v !== undefined && c.v !== null) cells[addr] = String(c.v)
    else if (c && c.t === 'z' && c.f) cells[addr] = '=' + c.f
  }
  dump[name] = {
    ref,
    merges: (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m)),
    cols: (ws['!cols'] || []).map((c) => (c && c.wpx ? Math.round(c.wpx) : null)),
    rows: Object.fromEntries(
      Object.entries(ws['!rows'] || {}).map(([i, r]) => [i, r && r.hpx ? Math.round(r.hpx) : null])
    ),
    cells,
  }
}

// 图表/控件信息由已解包目录补充(若调用方提供)
const unzippedDir = process.argv[3]
if (unzippedDir && fs.existsSync(unzippedDir)) {
  const extra = {}
  // 工作表 → 部件映射(workbook.xml + rels)
  const wbXml = fs.readFileSync(path.join(unzippedDir, 'xl/workbook.xml'), 'utf8')
  const relsXml = fs.readFileSync(path.join(unzippedDir, 'xl/_rels/workbook.xml.rels'), 'utf8')
  const relMap = {}
  for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2]
  const sheetParts = []
  for (const m of wbXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    sheetParts.push({ name: m[1], part: 'xl/' + relMap[m[2]].replace(/^\//, '') })
  }
  // 每个含 rels 的工作表:找 drawing/vml
  for (const sp of sheetParts) {
    const relsPath = path.join(unzippedDir, sp.part.replace('worksheets/', 'worksheets/_rels/') + '.rels')
    if (!fs.existsSync(relsPath)) continue
    const rx = fs.readFileSync(relsPath, 'utf8')
    const targets = [...rx.matchAll(/Target="([^"]+)"/g)].map((m) => m[1])
    if (targets.length) extra[sp.name] = targets
  }
  // 图表内容摘要
  const charts = {}
  for (let i = 1; i <= 8; i++) {
    const p = path.join(unzippedDir, `xl/charts/chart${i}.xml`)
    if (!fs.existsSync(p)) continue
    const cx = fs.readFileSync(p, 'utf8')
    const types = [...cx.matchAll(/<(c:barChart|c:lineChart|c:pieChart|c:scatterChart|c:areaChart|c:radarChart)/g)].map((m) => m[1].replace('c:', ''))
    const series = [...cx.matchAll(/<c:ser>[\s\S]*?<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/g)].map((m) => m[1])
    charts[`chart${i}`] = { types: [...new Set(types)], series }
  }
  dump.__extra = { sheetRels: extra, charts }
}

const out = path.join(__dirname, '_record-sheets-dump.json')
fs.writeFileSync(out, JSON.stringify(dump, null, 1), 'utf8')
console.log('WROTE ' + out)
for (const n of Object.keys(dump)) {
  if (n.startsWith('__')) continue
  const d = dump[n]
  console.log(`SHEET ${n}: ref=${d.ref} merges=${d.merges.length} cells=${Object.keys(d.cells).length}`)
}
