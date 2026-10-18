/**
 * 定性:262 键差异是「历史遗留」还是「本次引入」
 *  关键判据:看这些键的流水里有没有 rid 指向已删除单据行的孤儿行 / 同单重复过账
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// 每个键的流水行数 vs 单据行数
const rows = await q(`
  SELECT i.单据编号, i.物料编码, ISNULL(RTRIM(i.批号),'') AS l,
         COUNT(*) AS 流水行数,
         (SELECT COUNT(*) FROM bl_purchase_in x WHERE x.单据编号 = i.单据编号 AND x.存货编码 = i.物料编码) AS 单据行数,
         CAST(SUM(i.数量) AS decimal(18,2)) AS 流水量,
         MIN(CONVERT(varchar(19), i.asp_time1, 120)) AS 最早,
         MAX(CONVERT(varchar(19), i.asp_time1, 120)) AS 最晚,
         STRING_AGG(CAST(i.src AS varchar(4)) + ':' + ISNULL(i.asp_user1,''), ' | ') AS 来源
    FROM inh i
   WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND i.src = 1
   GROUP BY i.单据编号, i.物料编码, ISNULL(RTRIM(i.批号),'')
  HAVING COUNT(*) > (SELECT COUNT(*) FROM bl_purchase_in x WHERE x.单据编号 = i.单据编号 AND x.存货编码 = i.物料编码)`)

console.log(`「流水行数 > 单据行数」的 (单据,物料,批号) 组合:${rows.length} 组`)
for (const r of rows.slice(0, 12)) {
  console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.物料编码).padEnd(12)} 批=${String(r.l).padEnd(14)} 流水${r.流水行数}行/${r.流水量} 单据${r.单据行数}行`)
  console.log(`        来源=${r.来源}  写入 ${r.最早} ~ ${r.最晚}`)
}

// 这些重复行是什么时候写入的
const when = await q(`
  SELECT ISNULL(asp_user1,'(空)') AS u1, CONVERT(varchar(10), MIN(asp_time1), 120) AS 最早,
         CONVERT(varchar(10), MAX(asp_time1), 120) AS 最晚, COUNT(*) AS n
    FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src=1
     AND 单据编号 IN (SELECT 单据编号 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src=1
                       GROUP BY 单据编号, 物料编码 HAVING COUNT(*) > 1)
   GROUP BY asp_user1`)
console.log('\n重复涉及的流水来源与写入日期:')
for (const r of when) console.log(`   ${String(r.u1).padEnd(22)} ${String(r.n).padStart(5)} 行  写入 ${r.最早} ~ ${r.最晚}`)
await pool.close()
