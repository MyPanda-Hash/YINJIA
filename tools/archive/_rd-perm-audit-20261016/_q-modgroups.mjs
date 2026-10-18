import mssql from '../../../deploy/node_modules/mssql/index.js'
const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
const r = await p.request().query("SELECT ISNULL(module_group,N'(空)') AS g, COUNT(*) AS n, STRING_AGG(CAST(panel_code AS nvarchar(40)), ',') AS panels FROM yj_panel GROUP BY module_group ORDER BY n DESC")
for (const x of r.recordset) console.log(`${x.g}\t${x.n}\t${String(x.panels).slice(0,300)}`)
await p.close()
