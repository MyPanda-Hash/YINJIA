/**
 * 送料暂收单 / 来料检验单:「审核时间 / 审批时间 / 变更时间 / 创建时间 / 检验日期 / 留痕审核时间」
 * 全部跟随**源订单(采购订单)的单据日期**(2026-10-16,正式库)
 * 用户口径:「来料检验单和送料暂收单按源订单的单据日期来做修改。审核时间与变更时间也要做修改」。
 * 关联:sl_recv.采购订单号 → bd_pu_order.单据日期;qc_insp.暂收单号 → sl_recv.采购订单号 → bd_pu_order。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const run = async (label, sql) => {
  const n = (await pool.request().query(sql)).rowsAffected[0]
  console.log(`   ${label}: ${n} 行`)
  return n
}
const hasCol = async (t, c) => (await q(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('${t}') AND name=N'${c}'`))[0].n > 0

console.log('=== 送料暂收单 sl_recv ===')
const SLJ = `FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号`
for (const c of ['审核时间', '审批时间']) {
  if (await hasCol('sl_recv', c)) await run(`${c} → 单据日期`, `UPDATE x SET [${c}] = CONVERT(varchar(19), o.单据日期, 120) ${SLJ} WHERE ISNULL(x.[${c}],N'') <> CONVERT(varchar(19), o.单据日期, 120)`)
}
await run('创建时间(asp_time1) → 单据日期', `UPDATE x SET asp_time1 = o.单据日期 ${SLJ} WHERE x.asp_time1 IS NOT NULL AND CONVERT(date, x.asp_time1) <> CONVERT(date, o.单据日期)`)
await run('变更时间(asp_time2) → 单据日期', `UPDATE x SET asp_time2 = o.单据日期 ${SLJ} WHERE x.asp_time2 IS NOT NULL AND CONVERT(date, x.asp_time2) <> CONVERT(date, o.单据日期)`)

console.log('=== 来料检验单 qc_insp ===')
const IJJ = `FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号`
for (const c of ['审核时间', '审批时间', '检验日期']) {
  if (await hasCol('qc_insp', c)) await run(`${c} → 单据日期`, `UPDATE x SET [${c}] = CONVERT(varchar(19), o.单据日期, 120) ${IJJ} WHERE ISNULL(x.[${c}],N'') <> CONVERT(varchar(19), o.单据日期, 120)`)
}
await run('创建时间(asp_time1) → 单据日期', `UPDATE x SET asp_time1 = o.单据日期 ${IJJ} WHERE x.asp_time1 IS NOT NULL AND CONVERT(date, x.asp_time1) <> CONVERT(date, o.单据日期)`)
await run('变更时间(asp_time2) → 单据日期', `UPDATE x SET asp_time2 = o.单据日期 ${IJJ} WHERE x.asp_time2 IS NOT NULL AND CONVERT(date, x.asp_time2) <> CONVERT(date, o.单据日期)`)

console.log('=== 留痕 yj_doc_status(审核时间 shsj / 提交时间 pending_at)===')
await run('QC_RECV.shr 非空的留痕 shsj → 对应订单日期', `
  UPDATE s SET s.shsj = o.单据日期, s.pending_at = o.单据日期
  FROM yj_doc_status s JOIN sl_recv x ON x.单据编号 = s.doc_no JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE s.panel_code = 'QC_RECV' AND s.shr IS NOT NULL AND CONVERT(date, s.shsj) <> CONVERT(date, o.单据日期)`)
await run('QC_INSP.shr 非空的留痕 shsj → 对应订单日期', `
  UPDATE s SET s.shsj = o.单据日期, s.pending_at = o.单据日期
  FROM yj_doc_status s JOIN qc_insp i ON i.单据编号 = s.doc_no JOIN sl_recv sl ON sl.单据编号 = i.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE s.panel_code = 'QC_INSP' AND s.shr IS NOT NULL AND CONVERT(date, s.shsj) <> CONVERT(date, o.单据日期)`)

console.log('=== 复核 ===')
const bad = async (label, sql) => console.log(`   ${label} 不符 = ${(await q(sql))[0].n}`)
await bad('暂收单 单据日期', `SELECT COUNT(*) AS n FROM sl_recv x JOIN bd_pu_order o ON o.单据编号=x.采购订单号 WHERE CONVERT(date,x.单据日期)<>CONVERT(date,o.单据日期)`)
await bad('暂收单 审核时间', `SELECT COUNT(*) AS n FROM sl_recv x JOIN bd_pu_order o ON o.单据编号=x.采购订单号 WHERE x.审核时间 IS NOT NULL AND LEFT(x.审核时间,10)<>CONVERT(varchar(10),o.单据日期,120)`)
await bad('暂收单 创建时间', `SELECT COUNT(*) AS n FROM sl_recv x JOIN bd_pu_order o ON o.单据编号=x.采购订单号 WHERE x.asp_time1 IS NOT NULL AND CONVERT(date,x.asp_time1)<>CONVERT(date,o.单据日期)`)
await bad('检验单 单据日期', `SELECT COUNT(*) AS n FROM qc_insp x JOIN sl_recv sl ON sl.单据编号=x.暂收单号 JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE CONVERT(date,x.单据日期)<>CONVERT(date,o.单据日期)`)
await bad('检验单 审核时间', `SELECT COUNT(*) AS n FROM qc_insp x JOIN sl_recv sl ON sl.单据编号=x.暂收单号 JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE x.审核时间 IS NOT NULL AND LEFT(x.审核时间,10)<>CONVERT(varchar(10),o.单据日期,120)`)
await bad('检验单 创建时间', `SELECT COUNT(*) AS n FROM qc_insp x JOIN sl_recv sl ON sl.单据编号=x.暂收单号 JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE x.asp_time1 IS NOT NULL AND CONVERT(date,x.asp_time1)<>CONVERT(date,o.单据日期)`)
for (const r of await q(`SELECT TOP 4 单据编号, ISNULL(单据日期,N'') AS 单据日期, ISNULL(审核时间,N'(空)') AS 审核时间, ISNULL(检验日期,N'(空)') AS 检验日期, CONVERT(varchar(19),asp_time1,120) AS 创建, CONVERT(varchar(19),asp_time2,120) AS 变更 FROM qc_insp WHERE 单据日期 >= '2026-09-01' ORDER BY id DESC`)) console.log('   检验单样例 ' + JSON.stringify(r))
await pool.close()
