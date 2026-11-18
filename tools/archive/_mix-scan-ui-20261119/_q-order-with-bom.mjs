// 探针:扫码混料 走查取数
//   ① mate(《物料清单》)有没有数据、覆盖哪些产品
//   ② 哪张工单行的产品在 mate 里有用料(用它做工单码做界面走查)
// 用法: node tools/archive/_mix-scan-ui-20261119/_q-order-with-bom.mjs [数据库名]
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire('D:/YINJIA-main/deploy/')
const mssql = require('mssql')

const cfg = JSON.parse(readFileSync('D:/YINJIA-main/deploy/config.json', 'utf8'))
const db = process.argv[2] || cfg.database.database

const pool = await mssql.connect({
  server: cfg.database.server,
  port: cfg.database.port,
  database: db,
  user: cfg.database.user,
  password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true },
})

const one = async (sql) => (await pool.request().query(sql)).recordset

console.log('db =', db)
console.log('mate 行数:', JSON.stringify(await one('SELECT COUNT(1) AS n FROM dbo.mate')))
console.log('mate 产品数:', JSON.stringify(await one('SELECT COUNT(DISTINCT m_no) AS n FROM dbo.mate')))
console.log('mate 取样:', JSON.stringify(await one(
  "SELECT TOP (5) m_no, wzdm2, wzmc2, bzl, sl2 FROM dbo.mate WHERE ISNULL(wzdm2,N'') <> N''"), null, 2))
console.log('工单+有BOM的取样:', JSON.stringify(await one(`
  SELECT TOP (10) p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.dm AS 产品编号, p.mc AS 产品名称,
         CAST(ISNULL(p.pl_sl,0) AS decimal(18,4)) AS 排产数量,
         (SELECT COUNT(1) FROM dbo.mate m WHERE m.m_no = p.dm) AS BOM行数
    FROM dbo.plang p
   WHERE ISNULL(p.dm,N'') <> N''
     AND ISNULL(p.pl_sl,0) > 0
     AND EXISTS (SELECT 1 FROM dbo.mate m WHERE m.m_no = p.dm)
   ORDER BY p.pl_no DESC`), null, 2))
console.log('最近工单行(不论有没有BOM):', JSON.stringify(await one(`
  SELECT TOP (5) p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.dm AS 产品编号, p.mc AS 产品名称,
         CAST(ISNULL(p.pl_sl,0) AS decimal(18,4)) AS 排产数量
    FROM dbo.plang p WHERE ISNULL(p.dm,N'') <> N'' AND ISNULL(p.pl_sl,0) > 0
   ORDER BY p.pl_no DESC`), null, 2))

await pool.close()
