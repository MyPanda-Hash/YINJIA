import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
const q = async (s) => (await pool.request().query(s)).recordset
console.log(JSON.stringify(await q(`SELECT ISNULL(NULLIF(LTRIM(RTRIM(性别)),''),N'(空)') AS 性别, COUNT(*) AS n FROM dbo.bs_emp GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(性别)),''),N'(空)') ORDER BY n DESC`)))
console.log(JSON.stringify(await q(`SELECT TOP 6 所属部门, COUNT(*) n FROM dbo.bs_emp WHERE ISNULL(LTRIM(RTRIM(所属部门)),'')<>'' GROUP BY 所属部门 ORDER BY n DESC`)))
await pool.close()
