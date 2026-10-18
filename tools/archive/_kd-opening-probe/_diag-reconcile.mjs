/**
 * 定位「结存 vs 流水不一致」—— 到底是真的不一致,还是我的比对口径与代码不同
 *   代码口径(InvCostService.reconcileStockOnStartup):inh 全部(含 src=0 期初、含月结结转) − outh,按三键
 *   我的口径:排除了「月结结转」
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// A 代码口径:inh 全量(含月结结转) − outh
const a = (await q(`
  SELECT COUNT(*) AS bad FROM (
    SELECT ISNULL(x.k, b.k) AS k, ISNULL(x.net,0) AS net, ISNULL(b.yl,0) AS yl FROM
    (SELECT CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N'')) AS k, SUM(数量) AS net
       FROM (SELECT 物料编码,仓库编码,批号,数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
             UNION ALL SELECT 物料编码,仓库编码,批号,-数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') s
      GROUP BY CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N''))) x
    FULL OUTER JOIN
    (SELECT CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N'')) AS k, SUM(yl) AS yl
       FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
      GROUP BY CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N''))) b ON x.k=b.k
    WHERE ABS(ISNULL(x.net,0)-ISNULL(b.yl,0)) > 0.0001) t`))[0]
console.log(`A 代码口径(inh 全量,含月结结转):不一致 ${a.bad} 键`)

// B 月结结转行现状
const b = (await q(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(数量),0) AS decimal(18,2)) AS q
                      FROM inh WHERE 单据类型 = N'月结结转' AND ISNULL(asp_cancel,'N')<>'Y'`))[0]
console.log(`B 月结结转行:${b.n} 行 / 数量 ${b.q}`)

// C 期初行
const c = (await q(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(数量),0) AS decimal(18,2)) AS q
                      FROM inh WHERE src = 0 AND ISNULL(asp_cancel,'N')<>'Y'`))[0]
console.log(`C 期初行(src=0):${c.n} 行 / 数量 ${c.q}`)

// D 不一致的样例(用代码口径)
const d = await q(`
  SELECT TOP 8 x.k, ISNULL(x.net,0) AS 流水净额, ISNULL(b.yl,0) AS 结存
    FROM (SELECT CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N'')) AS k, SUM(数量) AS net
            FROM (SELECT 物料编码,仓库编码,批号,数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
                  UNION ALL SELECT 物料编码,仓库编码,批号,-数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') s
           GROUP BY CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N''))) x
    FULL OUTER JOIN
    (SELECT CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N'')) AS k, SUM(yl) AS yl
       FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
      GROUP BY CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N''))) b ON x.k=b.k
   WHERE ABS(ISNULL(x.net,0)-ISNULL(b.yl,0)) > 0.0001
   ORDER BY ABS(ISNULL(x.net,0)-ISNULL(b.yl,0)) DESC`)
console.log('\nD 不一致样例(代码口径):')
for (const r of d) console.log(`   ${String(r.k).padEnd(38)} 流水=${String(r.流水净额).padStart(12)} 结存=${String(r.结存).padStart(12)}`)
await pool.close()
