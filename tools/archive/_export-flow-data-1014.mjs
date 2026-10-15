/**
 * 导出「全链路流转数据」(2026-10-14,正式库)—— 与 kingdee-data-1014 配套,供同事完整还原链路
 *
 * 已导过的:8 类金蝶同步单据(头+行)+ yj_doc_status 留痕。
 * 本脚本补导**流转产生**的数据:
 *   送料暂收单 sl_recv/sl_recv_detail · 来料检验单 qc_insp/qc_insp_detail ·
 *   检验数据记录 qc_insp_rec/qc_insp_rec_detail · 检验项目目录 qc_insp_req ·
 *   生产工单 plang(含工序/来源订单)· 单选单占用链 form_flow_link(链路关系,还原必需)。
 *
 * 圈定口径(按单号前缀/本批标识,边界清晰):
 *   SL-2026-10-% / IJ-2026-10-% / JYSJ-2026-10-% / GD-2026-10-% / qc_insp_req.文件编码='QR-QC-001'
 *   form_flow_link:来源或目标单号落在上面这批里。
 *
 * 用法: node tools/archive/_export-flow-data-1014.mjs
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, appendFileSync } from 'node:fs'

const OUT = new URL('./_dump-out/kingdee-data-1014/', import.meta.url)
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
  writeFileSync(new URL(`${table}.csv`, OUT), csv, 'utf8')
  return { table, rows: rows.length, cols: cols.length, bytes: Buffer.byteLength(csv, 'utf8') }
}

const SL = "单据编号 LIKE 'SL-2026-10-%'"
const IJ = "单据编号 LIKE 'IJ-2026-10-%'"
const JY = "单据编号 LIKE 'JYSJ-2026-10-%'"
const GD = "pl_no LIKE 'GD-2026-10-%'"
const res = []
res.push(await dump('sl_recv', SL))
res.push(await dump('sl_recv_detail', SL))
res.push(await dump('qc_insp', IJ))
res.push(await dump('qc_insp_detail', IJ))
res.push(await dump('qc_insp_rec', JY))
res.push(await dump('qc_insp_rec_detail', JY))
res.push(await dump('qc_insp_req', "文件编码 = 'QR-QC-001'"))
res.push(await dump('plang', GD))
res.push(await dump('form_flow_link', `link_status = 'ACTIVE' AND (
    source_form_no LIKE 'SL-2026-10-%' OR target_form_no LIKE 'SL-2026-10-%'
 OR source_form_no LIKE 'IJ-2026-10-%' OR target_form_no LIKE 'IJ-2026-10-%'
 OR target_form_no LIKE 'GD-2026-10-%' OR source_form_no LIKE 'GD-2026-10-%'
 OR target_form_no LIKE 'PI-2026-10-%' OR source_form_no LIKE 'PI-2026-10-%'
 OR target_form_no LIKE 'JYSJ-2026-10-%')`))
await pool.close()

const total = res.reduce((a, r) => a + r.rows, 0)
const bytes = res.reduce((a, r) => a + (r.bytes || 0), 0)
for (const r of res) console.log(`   ${r.table.padEnd(20)} ${String(r.rows).padStart(5)} 行${r.cols ? ' / ' + r.cols + ' 列' : ''}`)
console.log(`   合计 ${total} 行 / ${(bytes / 1024).toFixed(0)} KB`)
appendFileSync(new URL('README.md', OUT), ['', '## 全链路流转数据(链路还原用)', '',
  '| 表 | 说明 |', '|---|---|',
  '| `sl_recv` / `sl_recv_detail` | 送料暂收单(采购订单选单生成) |',
  '| `qc_insp` / `qc_insp_detail` | 来料检验单(暂收单生单,按商品档案「来料检验」分流) |',
  '| `qc_insp_rec` / `qc_insp_rec_detail` | 检验数据记录 + 明细(检验项/检测标准/检测结果/单项判定) |',
  '| `qc_insp_req` | 检验项目目录(物料类别+物料编号 为业务键) |',
  '| `plang` | 生产工单(销售订单结转生成;`pl_date`=来源订单单据日期,`od_no`=来源销售订单号) |',
  '| `form_flow_link` | **单选单占用链**(来源↔目标单号/行键/数量/批次)—— 还原链路关系必需 |',
  '', `本次补导行数:${res.map((r) => r.table + ':' + r.rows).join(' / ')}(合计 ${total} 行)`,
  '', '> 链路顺序:采购订单 →(选单)→ 送料暂收单 →(生单)→ 来料检验单 →(填检验数据)→ 检验数据记录/检验项目目录;',
  '> 销售订单 →(工单结转)→ 生产工单;purchase_in(PI-*)为免检直达分支。'].join('\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/kingdee-data-1014/(已补 9 张表 + README 更新)')
