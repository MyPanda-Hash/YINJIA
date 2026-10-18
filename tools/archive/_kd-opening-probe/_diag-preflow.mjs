/**
 * 核实:9/1 之前的流水是否还残留在 inh/outh(它会让"全量流水"比对错位)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const a = (await q(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(数量),0) AS decimal(18,2)) AS q FROM inh
                     WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 < '2026-09-01'`))[0]
const b = (await q(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(数量),0) AS decimal(18,2)) AS q FROM outh
                     WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-09-01'`))[0]
console.log(`9/1 前 入库流水:${a.n} 行 / ${a.q}`)
console.log(`9/1 前 出库流水:${b.n} 行 / ${b.q}`)

const c = (await q(`SELECT COUNT(*) AS n FROM inh WHERE 单据类型=N'期初结存' AND ISNULL(asp_cancel,'N')<>'Y'`))[0]
console.log(`期初结存行:${c.n}`)

// 样例键:看它的全部流水
const rows = await q(`
  SELECT N'入' AS 方向, 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120) AS 日期,
         ISNULL(批号,N'(无)') AS 批号, CAST(数量 AS decimal(18,2)) AS 数量
    FROM inh WHERE 物料编码 = N'YJ-XWR-003' AND 仓库编码 = N'CK00006' AND ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT N'出', 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120),
         ISNULL(批号,N'(无)'), -数量
    FROM outh WHERE 物料编码 = N'YJ-XWR-003' AND 仓库编码 = N'CK00006' AND ISNULL(asp_cancel,'N')<>'Y'
   ORDER BY 日期, 方向`)
console.log(`\nYJ-XWR-003 | CK00006 的全部流水(${rows.length} 行):`)
for (const r of rows) console.log(`   ${r.日期} ${r.方向} ${String(r.单据类型).padEnd(10)} ${String(r.单据编号).padEnd(22)} 批=${String(r.批号).padEnd(14)} ${r.数量}`)

const k = await q(`SELECT ISNULL(lot_no,N'(无)') AS 批号, CAST(yl AS decimal(18,2)) AS 结存
                     FROM kucun WHERE wzdm=N'YJ-XWR-003' AND ckdm=N'CK00006' AND ISNULL(asp_cancel,'N')<>'Y'`)
console.log('\nkucun 中的结存行:')
for (const r of k) console.log(`   批=${String(r.批号).padEnd(14)} ${r.结存}`)
await pool.close()
