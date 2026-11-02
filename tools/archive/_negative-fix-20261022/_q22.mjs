/** 精确判定:流水行 vs 单据明细行(采购入库 / 产成品入库)的对应关系 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('采购入库:流水行数 vs 明细行数(逐单)')
for (const r of await q(`
  SELECT i.单据编号, COUNT(*) AS flow,
         (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=i.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') AS detail,
         (SELECT COUNT(*) FROM bd_purchase_in h WHERE h.单据编号=i.单据编号) AS head
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.单据类型=N'采购入库单'
   GROUP BY i.单据编号 HAVING COUNT(*) <> (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.单据编号=i.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y')
   ORDER BY 1`))
  console.log(`   ${String(r.单据编号).padEnd(24)} 流水=${String(r.flow).padStart(3)} 明细=${String(r.detail).padStart(3)} 头=${r.head}`)

line('产成品入库:流水行数 vs 明细行数(逐单)')
for (const r of await q(`
  SELECT i.单据编号, COUNT(*) AS flow,
         (SELECT COUNT(*) FROM bl_finish_in l WHERE l.单据编号=i.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') AS detail,
         (SELECT COUNT(*) FROM bd_finish_in h WHERE h.单据编号=i.单据编号) AS head
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.单据类型=N'产成品入库单'
   GROUP BY i.单据编号 HAVING COUNT(*) <> (SELECT COUNT(*) FROM bl_finish_in l WHERE l.单据编号=i.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y')
   ORDER BY 1`))
  console.log(`   ${String(r.单据编号).padEnd(24)} 流水=${String(r.flow).padStart(3)} 明细=${String(r.detail).padStart(3)} 头=${r.head}`)

line('rid 是否指向明细行 id(采购入库)')
for (const r of await q(`
  SELECT TOP 10 i.id, i.单据编号, i.rid, (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.id=i.rid) AS rid_hit, i.物料编码
    FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.单据类型=N'采购入库单' AND i.rid IS NOT NULL`)) console.log('   ' + JSON.stringify(r))

line('关键对照:CGRK-20260915-03213 明细实际有几行')
for (const r of await q(`SELECT id, 存货编码, 仓库, 仓库编码, 批量 = CAST(实收数量 AS decimal(18,2)), 批号, 批次号, CONVERT(varchar(10),asp_time1,120) t FROM bl_purchase_in WHERE 单据编号='CGRK-20260915-03213'`))
  console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT id, 单据编号, 供应商, CONVERT(varchar(10),单据日期,120) d FROM bd_purchase_in WHERE 单据编号='CGRK-20260915-03213'`))
  console.log('   head: ' + JSON.stringify(r))

line('全局:流水里存在但明细行里对不上的行数')
for (const r of await q(`
  SELECT CAST(COUNT(*) AS int) AS flow_rows FROM inh i
   WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND i.单据类型=N'采购入库单'`)) console.log('   采购入库流水总行数=' + r.flow_rows)
for (const r of await q(`SELECT COUNT(*) AS detail_rows FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'`)) console.log('   采购入库明细总行数=' + r.detail_rows)

await pool.close()
