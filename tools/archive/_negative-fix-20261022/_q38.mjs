/** 解释「结存 vs 流水」不一致行数从 1713 降到 348 的原因 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('含 / 不含 月结结转 的净额口径对比')
const both = await q(`
  WITH f AS (
    SELECT RTRIM(物料编码) w, ISNULL(RTRIM(仓库编码),'') c, ISNULL(RTRIM(批号),'') l, SUM(数量) n, 1 excl
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
     GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),''), SUM(数量), 0
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
     GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),''), -SUM(数量), NULL
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
     GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')
  ),
  e AS (SELECT w,c,l,SUM(n) net FROM f WHERE excl=1 GROUP BY w,c,l),
  a AS (SELECT w,c,l,SUM(n) net FROM f WHERE excl IS NULL OR excl=0 GROUP BY w,c,l)
  SELECT
    SUM(CASE WHEN ABS(CAST(ISNULL(k.yl,0) AS decimal(18,4)) - ISNULL(e.net,0)) > 0.0001 THEN 1 ELSE 0 END) as excl_carry,
    SUM(CASE WHEN ABS(CAST(ISNULL(k.yl,0) AS decimal(18,4)) - ISNULL(a.net,0)) > 0.0001 THEN 1 ELSE 0 END) as incl_carry,
    COUNT(*) total
  FROM kucun k LEFT JOIN e ON e.w=RTRIM(k.wzdm) AND e.c=ISNULL(RTRIM(k.ckdm),'') AND e.l=ISNULL(RTRIM(k.lot_no),'')
               LEFT JOIN a ON a.w=RTRIM(k.wzdm) AND a.c=ISNULL(RTRIM(k.ckdm),'') AND a.l=ISNULL(RTRIM(k.lot_no),'')
  WHERE ISNULL(k.asp_cancel,'N')<>'Y'`)
console.log('   ' + JSON.stringify(both[0]))
await pool.close()
