/**
 * 物理删除「软删」单据(2026-10-16,正式库)
 * 用户口径:「软删除的将数据库的数据也删除」。
 * 范围:**只清本次会话软删的 4 类面板**(采购入库单 / 来料检验单 / 检验数据记录 / 送料暂收单),
 *   其余面板的软删留痕(暂收退回单/特采单/模具/销售出库等 —— 非本次操作)一律不动。
 * 做法:先按 单号 备份(TSV),再删 头表 + 行表 + yj_doc_status 留痕。
 * 用法: node tools/archive/_purge-softdeleted-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const PANELS = [
  ['PURCHASE_IN', 'bd_purchase_in', 'bl_purchase_in', '单据编号'],
  ['QC_INSP', 'qc_insp', 'qc_insp_detail', '单据编号'],
  ['QC_INSP_REC', 'qc_insp_rec', 'qc_insp_rec_detail', '单据编号'],
  ['QC_RECV', 'sl_recv', 'sl_recv_detail', '单据编号'],
]
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rowsOut = ['面板\t单号']
const counts = []
for (const [panel, head, line] of PANELS) {
  const docs = (await pool.request().query(
    `SELECT doc_no FROM yj_doc_status WHERE panel_code='${panel}' AND ISNULL(canceled,'N')='Y'`)).recordset.map((r) => r.doc_no)
  if (!docs.length) { counts.push(`${panel}:0`); continue }
  for (const d of docs) rowsOut.push(`${panel}\t${d}`)
  counts.push(`${panel}:${docs.length}`)
  if (DRY) continue
  const lit = docs.map((x) => `N'${String(x).replace(/'/g, "''")}'`).join(',')
  const t = await pool.request().query(`SELECT COUNT(*) AS n FROM ${line} WHERE 单据编号 IN (${lit})`)
  const h = await pool.request().query(`SELECT COUNT(*) AS n FROM ${head} WHERE 单据编号 IN (${lit})`)
  await pool.request().query(`DELETE FROM ${line} WHERE 单据编号 IN (${lit})`)
  await pool.request().query(`DELETE FROM ${head} WHERE 单据编号 IN (${lit})`)
  await pool.request().query(`DELETE FROM yj_doc_status WHERE panel_code='${panel}' AND ISNULL(canceled,'N')='Y'`)
  console.log(`   ${panel}: 删头 ${h.recordset[0].n} 行 / 删行 ${t.recordset[0].n} 行 / 留痕 ${docs.length} 条`)
}
await pool.close()
console.log(`待物理删除: ${counts.join(' / ')}`)
if (DRY) { writeFileSync(new URL('./_dump-out/softdeleted-docs-1016.tsv', import.meta.url), rowsOut.join('\r\n'), 'utf8'); console.log('(dry-run 未删,清单已写 _dump-out/softdeleted-docs-1016.tsv)'); process.exit(0) }
writeFileSync(new URL('./_dump-out/softdeleted-docs-1016.tsv', import.meta.url), rowsOut.join('\r\n'), 'utf8')
console.log('[备份] tools/archive/_dump-out/softdeleted-docs-1016.tsv')
