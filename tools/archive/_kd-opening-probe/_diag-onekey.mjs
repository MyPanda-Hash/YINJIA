/**
 * 逐键追查差额最大的 YJ-JPL-066 | CK00006 | JPL-20260915
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const W = 'YJ-JPL-066', C = 'CK00006', L = 'JPL-20260915'
console.log(`=== ${W} | ${C} | ${L} ===`)

const flow = await q(`
  SELECT N'入' AS 方向, 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120) AS 日期,
         CAST(数量 AS decimal(18,2)) AS 数量
    FROM inh WHERE 物料编码=N'${W}' AND 仓库编码=N'${C}' AND ISNULL(RTRIM(批号),'')=N'${L}' AND ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT N'出', 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120), -数量
    FROM outh WHERE 物料编码=N'${W}' AND 仓库编码=N'${C}' AND ISNULL(RTRIM(批号),'')=N'${L}' AND ISNULL(asp_cancel,'N')<>'Y'
   ORDER BY 日期`)
console.log(`流水 ${flow.length} 行:`)
let s = 0
for (const r of flow) { s += Number(r.数量); console.log(`   ${r.日期} ${r.方向} ${String(r.单据类型).padEnd(10)} ${String(r.单据编号).padEnd(22)} ${String(r.数量).padStart(10)}  Σ=${s.toFixed(2)}`) }

const k = await q(`SELECT CAST(yl AS decimal(18,2)) AS yl, ISNULL(asp_user1,'') AS u1 FROM kucun
                    WHERE wzdm=N'${W}' AND ckdm=N'${C}' AND ISNULL(RTRIM(lot_no),'')=N'${L}' AND ISNULL(asp_cancel,'N')<>'Y'`)
console.log(`\nkucun 结存: ${k.map((r) => r.yl).join(',')}  (来源 ${k.map((r) => r.u1).join(',')})`)
console.log(`流水累计: ${s.toFixed(2)}`)

// 该物料该仓的全部批号
const all = await q(`SELECT ISNULL(RTRIM(lot_no),'(无)') AS l, CAST(yl AS decimal(18,2)) AS yl
                       FROM kucun WHERE wzdm=N'${W}' AND ckdm=N'${C}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY yl DESC`)
console.log(`\n该物料该仓全部批号结存(合计 ${all.reduce((a, b) => a + Number(b.yl), 0).toFixed(2)}):`)
for (const r of all) console.log(`   ${String(r.l).padEnd(16)} ${String(r.yl).padStart(10)}`)
await pool.close()
