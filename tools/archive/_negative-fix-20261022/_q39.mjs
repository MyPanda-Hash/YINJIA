/** 对比:执行前后「结存 vs 流水」的差异是否来自本次操作(按物料汇总维度) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// 按 (物料,仓库) 汇总看:本次只在个别键上加量,整体应对得上
const r = await q(`
  WITH f AS (
    SELECT RTRIM(物料编码) w, ISNULL(RTRIM(仓库编码),'') c, SUM(数量) n
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),'')
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), -SUM(数量)
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),'')
  ), n AS (SELECT w,c,SUM(n) net FROM f GROUP BY w,c)
  SELECT COUNT(*) total,
         SUM(CASE WHEN ABS(CAST(ISNULL(k.tot,0) AS decimal(18,4)) - ISNULL(n.net,0)) > 0.0001 THEN 1 ELSE 0 END) mism
    FROM (SELECT wzdm w, ISNULL(RTRIM(ckdm),'') c, SUM(yl) tot FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ISNULL(RTRIM(ckdm),'')) k
    LEFT JOIN n ON n.w=k.w AND n.c=k.c`)
console.log('按 (物料,仓库) 汇总:总键 ' + r[0].total + ' / 与流水净额不一致 ' + r[0].mism)

console.log('\n本次配平单贡献的入库合计(按物料):')
for (const x of await q(`SELECT 物料编码, CAST(SUM(数量) AS decimal(18,2)) q FROM inh WHERE 单据类型=N'其他入库单' AND 单据编号 IN
                           (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%') GROUP BY 物料编码 ORDER BY q DESC`))
  console.log(`   ${String(x.物料编码).padEnd(16)} ${String(x.q).padStart(12)}`)
await pool.close()
