// _q-pending-reports.cjs — 只读:测试账套待排产行是否有报工(挑「能撤销」的行做写库验证)
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql')
;(async () => {
  const db = await mssql.connect({
    server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  })
  const r = (await db.request().query(`
    SELECT p.id, p.pl_no, p.pl_xc, CONVERT(varchar(10),p.pl_date,120) d,
           (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y') AS reports
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,N'N')<>N'Y' AND ISNULL(p.scx,N'')=N''
    ORDER BY p.id`)).recordset
  for (const x of r) console.log(x)
  await db.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
