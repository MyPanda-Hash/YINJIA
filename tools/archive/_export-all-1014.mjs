/**
 * 重新导出「9/1 至今的全链路单据数据」(2026-10-14,正式库 HSDZ_MES)
 *
 * 用户口径:「要保证上传的单据都是 9.1 到现在的」。
 *   ⚠ 上一版按 `asp_user1='金蝶拉取'` 筛,**漏了 285 张**标记不同的单据(如生单产生的 PI-*),
 *     也漏了 9 月的流转单(上一版流转表按 'SL-2026-10-%' 这类十月前缀圈定)。
 *   ⇒ 本版**一律按「单据日期 >= 2026-09-01」筛**(不再看同步标记),行表/明细按头单单号关联;
 *     工单按 pl_date、占用链按 create_time 同口径。
 *
 * 覆盖:8 类单据(头+行) + 送料暂收单 + 来料检验单 + 检验数据记录(含明细) + 检验项目目录
 *      + 生产工单 + 单选单占用链 + 状态留痕 yj_doc_status = 27 张表。
 *
 * 用法: node tools/archive/_export-all-1014.mjs [--from 2026-09-01] [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const DRY = argv.includes('--dry')
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
const dump = async (table, where, file) => {
  const rows = (await pool.request().query(`SELECT * FROM ${table} WHERE ${where}`)).recordset
  const name = file || table
  if (!rows.length) { console.log(`   ${name.padEnd(20)} 0 行`); return { table: name, rows: 0 } }
  const cols = Object.keys(rows[0])
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n') + '\r\n'
  if (!DRY) writeFileSync(new URL(`${name}.csv`, OUT), csv, 'utf8')
  const dcol = cols.includes('单据日期') ? rows.map((r) => String(r.单据日期).slice(0, 10)).sort() : null
  console.log(`   ${name.padEnd(20)} ${String(rows.length).padStart(5)} 行${dcol ? `  ${dcol[0]} ~ ${dcol[dcol.length - 1]}` : ''}`)
  return { table: name, rows: rows.length, cols: cols.length }
}

// 8 类单据:头表按单据日期,行表按头表单号
const DOCS = [['bd_pu_order', 'bl_pu_order'], ['bd_so_order', 'bl_so_order'], ['bd_purchase_in', 'bl_purchase_in'],
  ['bd_sale_out', 'bl_sale_out'], ['bd_material_out', 'bl_material_out'], ['bd_finish_in', 'bl_finish_in'],
  ['bd_other_in', 'bl_other_in'], ['bd_other_out', 'bl_other_out']]
const res = []
console.log('— 8 类单据(头 + 行)—')
for (const [h, l] of DOCS) {
  res.push(await dump(h, `单据日期 >= '${FROM}'`))
  res.push(await dump(l, `单据编号 IN (SELECT 单据编号 FROM ${h} WHERE 单据日期 >= '${FROM}')`))
}
console.log('— 流转单据 —')
res.push(await dump('sl_recv', `单据日期 >= '${FROM}'`))
res.push(await dump('sl_recv_detail', `单据编号 IN (SELECT 单据编号 FROM sl_recv WHERE 单据日期 >= '${FROM}')`))
res.push(await dump('qc_insp', `单据日期 >= '${FROM}'`))
res.push(await dump('qc_insp_detail', `单据编号 IN (SELECT 单据编号 FROM qc_insp WHERE 单据日期 >= '${FROM}')`))
res.push(await dump('qc_insp_rec', `单据日期 >= '${FROM}'`))
res.push(await dump('qc_insp_rec_detail', `单据编号 IN (SELECT 单据编号 FROM qc_insp_rec WHERE 单据日期 >= '${FROM}')`))
res.push(await dump('qc_insp_req', `ISNULL(文件编码,N'') = N'QR-QC-001'`))
res.push(await dump('plang', `pl_date >= '${FROM}'`))
res.push(await dump('form_flow_link', `create_time >= '${FROM}'`))
// 状态留痕:覆盖以上所有单号(+ 面板白名单,避免把无关面板的全表带出)
const SCOPE = `
  (s.panel_code IN ('PU_ORDER','SO_ORDER','PURCHASE_IN','SALE_OUT','MATERIAL_OUT','FINISH_IN','OTHER_IN','OTHER_OUT')
    AND s.doc_no IN (SELECT 单据编号 FROM bd_pu_order WHERE 单据日期>='${FROM}' UNION SELECT 单据编号 FROM bd_so_order WHERE 单据日期>='${FROM}'
      UNION SELECT 单据编号 FROM bd_purchase_in WHERE 单据日期>='${FROM}' UNION SELECT 单据编号 FROM bd_sale_out WHERE 单据日期>='${FROM}'
      UNION SELECT 单据编号 FROM bd_material_out WHERE 单据日期>='${FROM}' UNION SELECT 单据编号 FROM bd_finish_in WHERE 单据日期>='${FROM}'
      UNION SELECT 单据编号 FROM bd_other_in WHERE 单据日期>='${FROM}' UNION SELECT 单据编号 FROM bd_other_out WHERE 单据日期>='${FROM}'))
  OR (s.panel_code='QC_RECV' AND s.doc_no IN (SELECT 单据编号 FROM sl_recv WHERE 单据日期>='${FROM}'))
  OR (s.panel_code='QC_INSP' AND s.doc_no IN (SELECT 单据编号 FROM qc_insp WHERE 单据日期>='${FROM}'))
  OR (s.panel_code='QC_INSP_REC' AND s.doc_no IN (SELECT 单据编号 FROM qc_insp_rec WHERE 单据日期>='${FROM}'))`
const stRows = (await pool.request().query(
  `SELECT s.panel_code, s.doc_no, s.shr, s.shsj, s.pending, s.pending_by, s.pending_at, s.canceled, s.cancel_by, s.cancel_at,
          s.archived, s.archived_at, s.stopped, s.stop_by, s.stop_at, s.saved, s.erp_close_state, s.approve_node, s.l2_approver,
          CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'
               WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废' WHEN ISNULL(s.archived,'N')='Y' THEN N'已完成'
               WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止' ELSE N'草稿' END AS 派生状态
   FROM yj_doc_status s WHERE ${SCOPE}`)).recordset
if (stRows.length && !DRY) {
  const cols = Object.keys(stRows[0])
  writeFileSync(new URL('yj_doc_status.csv', OUT),
    [cols.join(',')].concat(stRows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\r\n') + '\r\n', 'utf8')
}
console.log(`   ${'yj_doc_status'.padEnd(20)} ${String(stRows.length).padStart(5)} 行`)
await pool.close()

const total = res.reduce((a, r) => a + r.rows, 0) + stRows.length
console.log(`\n合计 ${total} 行(27 张表);口径:单据日期/pl_date/create_time >= ${FROM}`)
console.log(DRY ? '(dry-run,未落盘)' : '[产物] tools/archive/_dump-out/kingdee-data-1014/')
