/**
 * 修正「审核时间/创建/变更」被写成 00:00:00 导致界面显示**早一天**的问题(2026-10-16,正式库)
 *
 * 现象:上一轮把时间字段写成 `2026-10-13 00:00:00`,平台按 UTC 显示(-8h)后变成 10-12 16:00 ⇒ 界面早一天。
 * 修法:同一天统一写成 **12:00:00**(任何 ±8h 换算都仍落在同一日历日)。
 * 范围:送料暂收单 sl_recv / 来料检验单 qc_insp 的时间列 + 留痕 yj_doc_status.shsj / pending_at。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const run = async (label, sql) => console.log(`   ${label}: ${(await pool.request().query(sql)).rowsAffected[0]} 行`)
const hasCol = async (t, c) => (await q(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('${t}') AND name=N'${c}'`))[0].n > 0
const typOf = async (t, c) => (await q(`SELECT ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('${t}') AND c.name=N'${c}'`))[0].typ
const isDateTyp = (t) => ['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'].includes(t)

/** 把某列统一写成「源订单日期 + 12:00」 */
const fix = async (tbl, alias, col, join) => {
  if (!(await hasCol(tbl, col))) return
  const ty = await typOf(tbl, col)
  const expr = isDateTyp(ty)
    ? `DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))`
    : `CONVERT(varchar(10), o.单据日期, 120) + N' 12:00:00'`
  await run(`${tbl}.${col} → 订单日期 12:00`, `UPDATE ${alias} SET [${col}] = ${expr} ${join} WHERE o.单据日期 IS NOT NULL`)
}

const SLJ = `FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号`
const IJJ = `FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号`
console.log('=== 送料暂收单 ===')
for (const c of ['审核时间', '审批时间', '创建时间', '变更时间', 'asp_time1', 'asp_time2']) await fix('sl_recv', 'x', c, SLJ)
console.log('=== 来料检验单 ===')
for (const c of ['审核时间', '审批时间', '检验日期', '创建时间', '变更时间', 'asp_time1', 'asp_time2']) await fix('qc_insp', 'x', c, IJJ)
console.log('=== 留痕 yj_doc_status ===')
await run('QC_RECV shsj/pending_at → 订单日期 12:00', `
  UPDATE s SET s.shsj = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2)), s.pending_at = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM yj_doc_status s JOIN sl_recv x ON x.单据编号 = s.doc_no JOIN bd_pu_order o ON o.单据编号 = x.采购订单号
  WHERE s.panel_code='QC_RECV' AND s.shr IS NOT NULL`)
await run('QC_INSP shsj/pending_at → 订单日期 12:00', `
  UPDATE s SET s.shsj = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2)), s.pending_at = DATEADD(hour, 12, CAST(o.单据日期 AS datetime2))
  FROM yj_doc_status s JOIN qc_insp i ON i.单据编号 = s.doc_no JOIN sl_recv sl ON sl.单据编号 = i.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE s.panel_code='QC_INSP' AND s.shr IS NOT NULL`)

console.log('=== 复核(应为 12:00 且与单据日期同日)===')
for (const r of await q(`SELECT TOP 4 i.单据编号, ISNULL(i.单据日期,N'') AS 单据日期, ISNULL(i.审核时间,N'(空)') AS 审核时间, CONVERT(varchar(19), i.asp_time1, 120) AS 创建, CONVERT(varchar(19), s.shsj, 120) AS 留痕 FROM qc_insp i LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号 WHERE i.单据日期>='2026-09-01' ORDER BY i.id DESC`)) console.log('   检验单 ' + JSON.stringify(r))
for (const r of await q(`SELECT TOP 3 x.单据编号, ISNULL(x.单据日期,N'') AS 单据日期, ISNULL(x.审核时间,N'(空)') AS 审核时间, CONVERT(varchar(19), x.asp_time1, 120) AS 创建 FROM sl_recv x WHERE x.单据日期>='2026-09-01' ORDER BY x.id DESC`)) console.log('   暂收单 ' + JSON.stringify(r))
await pool.close()
