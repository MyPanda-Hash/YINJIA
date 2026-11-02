/** 确认:47 处「同单据同物料同仓库同数量」是重复导入还是正常多行 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('重复入库:保留行与多余行是否完全相同(id/时间/批号/rid)')
for (const no of ['CGRK-20260915-03213', 'CPRK-20261005-00005', 'CGRK-20260928-03309', 'CGRK-20260904-03126']) {
  console.log(`   --- ${no} ---`)
  for (const r of await q(`SELECT id, rid, 物料编码, 仓库编码, 批号, CAST(数量 AS decimal(18,2)) AS qty, 单价,
                                  CONVERT(varchar(19),asp_time1,120) AS t1, asp_user1, 单据日期
                             FROM inh WHERE 单据编号='${no}' ORDER BY id`))
    console.log(`     id=${String(r.id).padEnd(7)} rid=${pad(r.rid)} ${String(r.物料编码).padEnd(15)} ${String(r.仓库编码).padEnd(9)} lot=${String(r.批号 ?? '(null)').padEnd(14)} q=${String(r.qty).padStart(9)} 单价=${r.单价 ?? 'NULL'} @${r.t1} by=${r.asp_user1}`)
}

line('这些单据在单据表里各占几行')
for (const no of ['CGRK-20260915-03213', 'CPRK-20261005-00005', 'CGRK-20260928-03309']) {
  const h = await q(`SELECT 单据编号, 供应商, 单据日期, 审核人, 创建时间 FROM bd_purchase_in WHERE 单据编号='${no}'`)
  const l = await q(`SELECT id, 存货编码, CAST(实收数量 AS decimal(18,2)) AS q, 批号 FROM bl_purchase_in WHERE 单据编号='${no}'`)
  console.log(`   ${no}: 头 ${h.length} 行, 明细 ${l.length} 行 -> ${l.map((x) => `${x.存货编码}/${x.q}/${x.批号 ?? 'null'}`).join(' | ')}`)
}

line('全局:同单据同物料同仓库同数量的分布(按单据类型)')
for (const r of await q(`
  WITH d AS (
    SELECT 单据编号, 物料编码, 仓库编码, 数量, COUNT(*) AS n, 单据类型
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型 IN (N'采购入库单',N'产成品入库单')
     GROUP BY 单据编号, 物料编码, 仓库编码, 数量, 单据类型 HAVING COUNT(*) > 1)
  SELECT 单据类型 AS t, SUM(n-1) AS dup_rows, COUNT(*) AS grp FROM d GROUP BY 单据类型`))
  console.log('   ' + JSON.stringify(r))

function pad(v) { return String(v ?? '').padEnd(6) }

line('对照:这些单据的明细行数 vs 流水行数(多出来的就是重复)')
for (const r of await q(`
  SELECT TOP 12 i.单据编号, i.单据类型, COUNT(*) AS flow_rows, COUNT(DISTINCT CONCAT(i.物料编码,'|',i.仓库编码,'|',i.数量)) AS distinct_rows
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.单据类型 IN (N'采购入库单',N'产成品入库单')
   GROUP BY i.单据编号, i.单据类型 HAVING COUNT(*) > COUNT(DISTINCT CONCAT(i.物料编码,'|',i.仓库编码,'|',i.数量))
   ORDER BY COUNT(*) DESC`))
  console.log(`   ${String(r.单据编号).padEnd(24)} ${String(r.单据类型).padEnd(10)} 流水 ${String(r.flow_rows).padStart(3)} 行 / 去重后 ${String(r.distinct_rows).padStart(3)} 行`)

await pool.close()
