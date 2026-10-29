/**
 * _patch-print-ondone.cjs — 给 printProductCards 透传 opts(含 onDone)(2026-10-29)
 * 幂等:已打过就跳过。
 */
const fs = require('fs')
const path = require('path')
const FILE = path.join(__dirname, '..', '..', 'frontend', 'src', 'business', 'print-formats.js')
let t = fs.readFileSync(FILE, 'utf8')

const OLD_SIG = 'export async function printProductCards(rows) {'
const NEW_SIG = 'export async function printProductCards(rows, opts) {'
const OLD_CALL = "  if (!printInPage('产品标识卡', body)) { alert(PRINT_FAIL_MSG); return false }"
const NEW_CALL = [
  '  // opts.onDone:打印结束(afterprint)后才回调 —— 调用方用它把「刷新数据」推迟到打印层摘掉之后,',
  '  // 避免打印对话框打开期间还去重绘界面(2026-10-29 供应商现场「打印卡死」)',
  "  if (!printInPage('产品标识卡', body, opts)) { alert(PRINT_FAIL_MSG); return false }",
].join('\n')

let n = 0
if (t.includes(NEW_SIG) && t.includes('printInPage(\'产品标识卡\', body, opts)')) {
  console.log('已经是目标状态,跳过')
  process.exit(0)
}
if (t.includes(OLD_SIG)) { t = t.replace(OLD_SIG, NEW_SIG); n++ }
if (t.includes(OLD_CALL)) { t = t.replace(OLD_CALL, NEW_CALL); n++ }
fs.writeFileSync(FILE, t, 'utf8')
console.log('替换处数 =', n)
