/**
 * 精确核实「孤儿流水行」(rid 在单据行表里找不到)
 * ⚠ 之前写错:NOT EXISTS 里的 l.id=i.rid 因 int/bigint 隐式转换在数据量下表现异常,
 *   改为显式 CAST 并分别单查。
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const checks = [
  ['采购入库', 1, 'bl_purchase_in'],
  ['产成品入库', 2, 'bl_finish_in'],
  ['其他入库', 3, 'bl_other_in'],
]
for (const [name, src, tbl] of checks) {
  const r = (await q(`
    SELECT COUNT(*) AS n, CAST(ISNULL(SUM(i.数量),0) AS decimal(18,2)) AS q,
           SUM(CASE WHEN ISNULL(i.rid,-1) < 0 THEN 1 ELSE 0 END) AS 无rid
      FROM inh i
     WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND i.src = ${src}
       AND (i.rid IS NULL OR NOT EXISTS (SELECT 1 FROM ${tbl} l WHERE CAST(l.id AS bigint) = CAST(i.rid AS bigint)))`))[0]
  const total = (await q(`SELECT COUNT(*) AS n FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src=${src}`))[0]
  console.log(`${name}(src=${src}): 孤儿 ${r.n} / 总 ${total.n}  · 其中无 rid ${r.无rid} · 数量合计 ${r.q}`)
}

console.log('')
const out = (await q(`
  SELECT COUNT(*) AS n FROM outh o
   WHERE ISNULL(o.asp_cancel,'N') <> 'Y'
     AND (o.rid IS NULL OR NOT EXISTS (
          SELECT 1 FROM bl_sale_out l WHERE CAST(l.id AS bigint)=CAST(o.rid AS bigint)))`))[0]
const outAll = (await q(`SELECT COUNT(*) AS n FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0]
console.log(`出库:孤儿 ${out.n} / 总 ${outAll.n}`)

console.log('\n孤儿行来源:')
const src = await q(`
  SELECT ISNULL(asp_user1,'(空)') AS u1, 单据类型, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS q
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.src BETWEEN 1 AND 3
     AND (i.rid IS NULL OR NOT EXISTS (SELECT 1 FROM bl_purchase_in l WHERE CAST(l.id AS bigint)=CAST(i.rid AS bigint))
                            AND NOT EXISTS (SELECT 1 FROM bl_finish_in l WHERE CAST(l.id AS bigint)=CAST(i.rid AS bigint))
                            AND NOT EXISTS (SELECT 1 FROM bl_other_in l WHERE CAST(l.id AS bigint)=CAST(i.rid AS bigint)))
   GROUP BY asp_user1, 单据类型 ORDER BY COUNT(*) DESC`)
for (const r of src) console.log(`   ${String(r.u1).padEnd(22)} ${String(r.单据类型).padEnd(12)} ${String(r.n).padStart(4)} 行 / ${r.q}`)
await pool.close()
