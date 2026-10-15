/**
 * 体检(2026-10-15):逐张核对**文档里要展示的界面**当前到底有没有数据。
 *
 * 为什么必须做:用户反馈「截图的都是空面板的数据」——
 *   不能靠"我拍的时候页面有文字"来判,要直接查**面板数据源的行数**,
 *   并按「文档里这张图本该展示什么」判定:数据为 0 的图就是空面板图,不可交付。
 *
 * 口径:面板 → line_table(flat 报表取视图;doc 取行表),COUNT(*) 即该界面的数据量。
 * 只读。用法: node tools/archive/_audit-shots-data-1015.mjs [dbName]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DB = process.argv[2] || 'HSDZ_MES'
const TMP = join(process.env.TEMP || '/tmp', '_audit-' + Date.now() + '.out')

// 文档里出现的面板(doc 侧由我此前逐张读图确认)
const PANELS = [
  ['MES', '组织架构(路由 /sys/org)'],
  ['MES', '使用权限查看(路由 /sys/usage)'],
  ['MES', 'ZDGL 数据字典'],
  ['MES', 'ROUTE 工艺路线'],
  ['MES', 'INV 商品'],
  ['MES', 'MANU_ORDER 生产工单'],
  ['MES', '快速排产(路由 scheduleBoard)'],
  ['MES', '工单排产(路由 workOrderBoard)'],
  ['MES', 'WO_REPORT_LIST 报工记录'],
  ['MES', 'PROD_ABN 生产异常处理单'],
  ['MES', 'QC_INSP 来料检验单'],
  ['MES', 'QC_INSP_REC 检验数据记录'],
  ['MES', '我的桌面(路由 dashboard)'],
  ['WMS', 'PURCHASE_IN 采购入库单'],
  ['WMS', 'INV 商品'],
  ['WMS', 'STOCK_STATUS 库存状况表'],
  ['WMS', 'FINISH_IN 产成品入库单'],
  ['WMS', 'SALE_OUT 销售出库单'],
  ['WMS', 'STOCK_LEDGER 库存台账'],
  ['WMS', 'ERPLG ERP导入日志'],
]

// 先取每个面板的 line_table
const q1 = `SET NOCOUNT ON;
SELECT panel_code + '|' + ISNULL(line_table,'') FROM yj_panel WHERE panel_code IN
('ZDGL','ROUTE','INV','MANU_ORDER','WO_REPORT_LIST','PROD_ABN','QC_INSP','QC_INSP_REC','PURCHASE_IN','STOCK_STATUS','FINISH_IN','SALE_OUT','STOCK_LEDGER','ERPLG');`
writeFileSync(TMP.replace(/\.out$/, '.sql'), q1, 'utf8')
const tables = new Map()
try {
  const out = execFileSync('java', ['-cp', '.;lib/mssql-jdbc.jar', 'archive/_q.java',
    'archive/' + TMP.split(/[\\/]/).pop().replace(/\.out$/, '.sql'), DB, TMP],
    { cwd: 'tools', encoding: 'utf8', env: { ...process.env, YINJIA_SQL_PASS: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } })
  for (const line of readFileSync(TMP, 'utf8').split(/\r?\n/).slice(1)) {
    const [code, lt] = line.split('|')
    if (code && lt) tables.set(code.trim(), lt.trim())
  }
} catch (e) {
  console.error('取表名失败:', String(e.message).slice(0, 300))
}

// 逐表计数
const counts = new Map()
const names = [...new Set([...tables.values()])].filter(Boolean)
if (names.length) {
  const sql = 'SET NOCOUNT ON;\n' + names.map((t) => `SELECT '${t}|' + CAST(COUNT(*) AS varchar(20)) FROM ${t};`).join('\n')
  const f = join(process.env.TEMP || '/tmp', '_audit2-' + Date.now() + '.sql')
  writeFileSync(f, sql, 'utf8')
  const o2 = join(process.env.TEMP || '/tmp', '_audit2-' + Date.now() + '.out')
  try {
    execFileSync('java', ['-cp', '.;lib/mssql-jdbc.jar', 'archive/_q.java', f.replace(/\\/g, '/'), DB, o2],
      { cwd: 'tools', encoding: 'utf8', env: { ...process.env, YINJIA_SQL_PASS: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } })
    for (const line of readFileSync(o2, 'utf8').split(/\r?\n/)) {
      const i = line.lastIndexOf('|')
      if (i > 0) counts.set(line.slice(0, i).trim(), parseInt(line.slice(i + 1), 10))
    }
  } catch (e) { console.error('计数失败:', String(e.message).slice(0, 300)) }
}

console.log(`=== ${DB} 各界面数据量 ===`)
let empty = 0
for (const [doc, label] of PANELS) {
  const m = label.match(/^(\w+)\s/)
  const code = m ? m[1] : null
  const lt = code ? tables.get(code) : null
  const n = lt ? counts.get(lt) : undefined
  const flag = n === undefined ? '  ?  ' : n === 0 ? '空!!' : ' 有 '
  if (n === 0) empty++
  console.log(`${flag} [${doc}] ${label}${lt ? '  (' + lt + ' = ' + (n ?? '?') + ')' : ''}`)
}
console.log(`\n空数据界面: ${empty} 个`)
try { unlinkSync(TMP) } catch {}
process.exit(0)
