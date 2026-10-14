/**
 * 导出「金蝶同步的近一个月单据数据」(2026-10-14,正式库 HSDZ_MES)
 *
 * 用户口径(方案 A):数据本身也要进云端仓库,供同事拉取/提取。
 * 导出 8 类单据 × (头表 + 行表) = 16 个 CSV,只含**本仓从金蝶同步进来的**单据
 * (asp_user1='金蝶拉取' 且头表单据日期 >= 2026-09-01);行表按头表单号过滤。
 *
 * 格式:UTF-8 **无 BOM**(仓库惯例),首行表头,值做最小转义(含逗号/引号/换行时加双引号)。
 * 同时产出 README.md 说明每份文件的行数、来源表、导入提示。
 *
 * 用法: node tools/archive/_export-synced-docs-1014.mjs [--from 2026-09-01]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const OUT = new URL('./_dump-out/kingdee-data-1014/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const DOCS = [
  ['采购订单', 'bd_pu_order', 'bl_pu_order'],
  ['销售订单', 'bd_so_order', 'bl_so_order'],
  ['采购入库单', 'bd_purchase_in', 'bl_purchase_in'],
  ['销售出库单', 'bd_sale_out', 'bl_sale_out'],
  ['生产领料单', 'bd_material_out', 'bl_material_out'],
  ['产品入库单', 'bd_finish_in', 'bl_finish_in'],
  ['其他入库单', 'bd_other_in', 'bl_other_in'],
  ['其他出库单', 'bd_other_out', 'bl_other_out'],
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

const cell = (v) => {
  if (v === null || v === undefined) return ''
  let s = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v)
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}
const dump = async (table, where) => {
  const rows = (await pool.request().query(`SELECT * FROM ${table} WHERE ${where}`)).recordset
  if (!rows.length) return { table, rows: 0 }
  const cols = Object.keys(rows[0])
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n') + '\r\n'
  const file = `${table}.csv`
  writeFileSync(new URL(file, OUT), csv, 'utf8')
  return { table, file, rows: rows.length, cols: cols.length, bytes: Buffer.byteLength(csv, 'utf8') }
}

const summary = []
for (const [name, head, line] of DOCS) {
  const hw = `asp_user1 = N'金蝶拉取' AND 单据日期 >= '${FROM}'`
  const h = await dump(head, hw)
  const l = await dump(line, `单据编号 IN (SELECT 单据编号 FROM ${head} WHERE ${hw})`)
  summary.push({ name, head: h, line: l })
  console.log(`${name.padEnd(6)} ${head.padEnd(18)} ${String(h.rows).padStart(5)} 行 / ${String(h.cols || 0).padStart(3)} 列;${line.padEnd(18)} ${String(l.rows).padStart(6)} 行`)
}
await pool.close()

const totalRows = summary.reduce((a, s) => a + (s.head.rows || 0) + (s.line.rows || 0), 0)
const totalBytes = summary.reduce((a, s) => a + (s.head.bytes || 0) + (s.line.bytes || 0), 0)
const readme = [
  '# 金蝶同步单据数据导出(近一个月)',
  '',
  `- 来源库:**HSDZ_MES(正式)**;筛选:\`asp_user1='金蝶拉取'\` 且头表单据日期 ≥ **${FROM}**`,
  `- 导出时间:${new Date().toISOString()}`,
  `- 合计 **${totalRows}** 行 / 约 ${(totalBytes / 1048576).toFixed(1)} MB(UTF-8 无 BOM,首行表头)`,
  '',
  '| 单据 | 头表 CSV | 头行数 | 行表 CSV | 行数 |',
  '|---|---|---|---|---|',
  ...summary.map((s) => `| ${s.name} | \`${s.head.file || s.head.table}\` | ${s.head.rows} | \`${s.line.file || s.line.table}\` | ${s.line.rows} |`),
  '',
  '## 怎么用',
  '',
  '1. **导入自己的库**:CSV 与 MES 表列一一对应(`SELECT *` 全列导出),按 `单据编号` 关联头/行;',
  '2. **要重新从金蝶拉**:用 `tools/archive/_pull-kingdee-docs-1014.mjs`(需金蝶账套凭据,幂等、可 `--types/--limit` 试跑);',
  '3. **字段含义与金蝶键对照**:见 `docs/development/出入库单据字段与显示字段.md` 与 `tools/archive/_dump-out/kingdee-*-fields-1014.md`。',
  '',
  '> ⚠ 这是**客户真实业务数据**(含客户/供应商/数量/金额/批次),仓库为云端共享仓库,请按公司数据外发口径使用。',
].join('\n')
writeFileSync(new URL('README.md', OUT), readme, 'utf8')
console.log(`\n合计 ${totalRows} 行 / ${(totalBytes / 1048576).toFixed(1)} MB`)
console.log('[产物] tools/archive/_dump-out/kingdee-data-1014/')
