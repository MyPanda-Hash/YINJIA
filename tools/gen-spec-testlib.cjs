/**
 * gen-spec-testlib.cjs — 从测试项目汇总.xlsx 生成规格书检验标准库(分组结构)
 * 输出: tools/_walk/specTestLib.generated.js(组数组,供 recordSheetConfigs 引用)
 * 结构: [{name, subs: [{name?(子项目), req, method, basis}]}] —— 单子项组 subs=[{req,...}]
 * 合并规则: C 列出现新值=新组;D 列出现新值=新子项;D 合并跨行且 E 有值=当前子项追加多行检验要求
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const FILE = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.1规格书/测试项目汇总.xlsx'
const wb = XLSX.readFile(FILE, { cellStyles: true, sheetStubs: true })
const ws = wb.Sheets['Sheet1']
const cells = {}
for (const addr of Object.keys(ws)) {
  if (addr.startsWith('!')) continue
  const c = ws[addr]
  if (c && c.v !== undefined && c.v !== null && String(c.v).trim() !== '') cells[addr] = String(c.v)
}
const cellAt = (col, row) => cells[col + row]
const range = (s, e) => { const out = []; let n = parseInt(s.slice(1)); const end = parseInt(e.slice(1)); for (; n <= end; n++) out.push(n); return out }

const groups = []
let cur = null
const rows = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54]
for (const r of rows) {
  const cName = cellAt('C', r)
  const dName = cellAt('D', r)
  const eVal = cellAt('E', r)
  const fVal = cellAt('F', r)
  const gVal = cellAt('G', r)
  if (cName) {
    // 新组(C 列组名;D 列同格合并=无子项目)
    cur = { name: cName.replace(/\n/g, ' '), subs: [] }
    groups.push(cur)
    if (eVal) cur.subs.push({ name: (dName || '').replace(/\n/g, ' '), req: eVal, method: fVal || '', basis: gVal || '' })
    else if (dName) cur.subs.push({ name: dName.replace(/\n/g, ' '), req: '', method: '', basis: '' })
  } else if (cur) {
    if (dName) {
      cur.subs.push({ name: dName.replace(/\n/g, ' '), req: eVal || '', method: fVal || '', basis: gVal || '' })
    } else if (eVal && cur.subs.length) {
      // D 合并跨行:当前子项多行检验要求/方法/依据
      const last = cur.subs[cur.subs.length - 1]
      last.req = last.req ? last.req + '\n' + eVal : eVal
      if (fVal) last.method = fVal
      if (gVal) last.basis = gVal
    }
  }
}

const out = `// 规格书检验标准库(分组)——由 tools/gen-spec-testlib.cjs 从《测试项目汇总.xlsx》生成(勿手改)
// {name: 组名, subs: [{name: 子项目(单子项组为空), req: 检验要求(可多行), method: 检验方法, basis: 检验依据}]}
export const SPEC_TEST_LIB = ${JSON.stringify(groups, null, 2)}
`
const target = path.join(__dirname, '../frontend/src/core/views/specTestLib.js')
fs.writeFileSync(target, out, 'utf8')
console.log('written: ' + target + ' groups=' + groups.length + ' subs=' + groups.reduce((s, g) => s + g.subs.length, 0))
for (const g of groups) console.log(`  [${g.name}] subs=${g.subs.length}` + g.subs.map((s) => ` ${s.name ? '(' + s.name + ')' : '(单)'}`).join(','))

