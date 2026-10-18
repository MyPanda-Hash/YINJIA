/**
 * 两账套最终核对:PC0000 归一后的结存一致性
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const SQL = `
  SELECT COUNT(*) AS bad FROM (
    SELECT ISNULL(a.k, b.k) AS k, ISNULL(a.net,0) AS net, ISNULL(b.yl,0) AS yl FROM
    (SELECT CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(RTRIM(批号),N'')) AS k,
            SUM(数量) AS net
       FROM (SELECT 物料编码, 仓库编码, 批号, 数量 FROM inh
              WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,N'') <> N'月结结转'
             UNION ALL
             SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
              WHERE ISNULL(asp_cancel,'N') <> 'Y') s
      GROUP BY CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(RTRIM(批号),N''))) a
    FULL OUTER JOIN
    (SELECT CONCAT(wzdm, N'|', ISNULL(RTRIM(ckdm),N''), N'|', ISNULL(RTRIM(lot_no),N'')) AS k, SUM(yl) AS yl
       FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'
      GROUP BY CONCAT(wzdm, N'|', ISNULL(RTRIM(ckdm),N''), N'|', ISNULL(RTRIM(lot_no),N''))) b
      ON a.k = b.k
    WHERE ABS(ISNULL(a.net,0) - ISNULL(b.yl,0)) > 0.0001
  ) x`

const STAT = `
  SELECT
    (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun行,
    (SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS 余量,
    (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND yl<0) AS 批次负结存,
    (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND (lot_no IS NULL OR RTRIM(lot_no)='')) AS 无批号行,
    (SELECT COUNT(*) FROM inh WHERE RTRIM(ISNULL(批号,''))=N'PC0000')
      + (SELECT COUNT(*) FROM outh WHERE RTRIM(ISNULL(批号,''))=N'PC0000')
      + (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no,''))=N'PC0000') AS PC0000残留`

for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
    password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
  const st = (await pool.request().query(STAT)).recordset[0]
  const bad = (await pool.request().query(SQL)).recordset[0]
  const negMat = (await pool.request().query(`
    SELECT COUNT(*) AS n FROM (SELECT wzdm, ckdm, SUM(yl) AS s FROM kucun
      WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ckdm HAVING SUM(yl) < -0.0001) t`)).recordset[0]
  console.log(`\n=== ${db} ===`)
  console.log(`  PC0000 残留        ${st.PC0000残留}  ${st.PC0000残留 === 0 ? '✅' : '❌'}`)
  console.log(`  kucun              ${st.kucun行} 行 / 余量 ${st.余量}`)
  console.log(`  无批号行           ${st.无批号行}`)
  console.log(`  批次负结存         ${st.批次负结存} 行`)
  console.log(`  按(物料,仓库)真缺货 ${negMat.n} 组`)
  console.log(`  结存vsΣ流水不一致   ${bad.bad}  ${bad.bad === 0 ? '✅' : '❌'}`)
  await pool.close()
}
