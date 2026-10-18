/**
 * 查 CGRK-20260916-03215 为什么会有一条"无批号 +10000"
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== ① inh 里该单的全部流水行 ===')
const a = await q(`SELECT id, src, rid, 单据编号, 物料编码, ISNULL(批号,N'(无)') AS 批号,
                          CAST(数量 AS decimal(18,2)) AS 数量, ISNULL(asp_user1,'') AS u1,
                          CONVERT(varchar(19),asp_time1,120) AS t1
                     FROM inh WHERE 单据编号 = N'CGRK-20260916-03215' ORDER BY id`)
for (const r of a) console.log(`   id=${r.id} src=${r.src} rid=${r.rid} ${r.物料编码} 批=${String(r.批号).padEnd(14)} ${r.数量}  ${r.u1} ${r.t1}`)

console.log('\n=== ② 单据行表 bl_purchase_in 的原貌 ===')
const b = await q(`SELECT id, 存货编码, ISNULL(批次号,N'(无)') AS 批次号, ISNULL(批号,N'(无)') AS 批号,
                          CAST(实收数量 AS decimal(18,2)) AS 实收数量
                     FROM bl_purchase_in WHERE 单据编号 = N'CGRK-20260916-03215' ORDER BY id`)
for (const r of b) console.log(`   id=${r.id} ${r.存货编码} 批次号=${String(r.批次号).padEnd(14)} 批号=${String(r.批号).padEnd(14)} ${r.实收数量}`)

console.log('\n=== ③ 全库:同一单据编号 + 同一物料 + 同一批号 出现多行(疑似重复过账) ===')
const c = await q(`SELECT COUNT(*) AS 组数 FROM (
    SELECT 单据编号, 物料编码, ISNULL(批号,'') AS l FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
     GROUP BY 单据编号, 物料编码, ISNULL(批号,'') HAVING COUNT(*)>1) t`)
console.log(`   重复组数:${c[0].组数}`)

console.log('\n=== ④ 无批号行的来源分布 ===')
const d = await q(`SELECT 单据类型, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS q
                     FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND (批号 IS NULL OR RTRIM(批号)='')
                      AND src BETWEEN 1 AND 8
                    GROUP BY 单据类型 ORDER BY COUNT(*) DESC`)
for (const r of d) console.log(`   ${String(r.单据类型).padEnd(12)} ${String(r.n).padStart(5)} 行 / ${r.q}`)
await pool.close()
