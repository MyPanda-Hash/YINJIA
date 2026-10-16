import mssql from '../../../deploy/node_modules/mssql/index.js'
const names = ["migrate-lot-rename-to-batchno.sql","migrate-fourdoc-baseline-restore-20261008.sql","migrate-fourdoc-bloodline-cols-20261008.sql"]
for (const db of ['HSDZ_MES','HSDZ_MES_TEST']) {
  const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:db, user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
  const cols = (await p.request().query("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_schema_log') ORDER BY c.column_id")).recordset.map(x=>x.name)
  if (db === 'HSDZ_MES') console.log('yj_schema_log 列: ' + cols.join(','))
  const fileCol = cols.find(c=>/file|script|name/i.test(c))
  const timeCol = cols.find(c=>/time|at|date/i.test(c))
  console.log('== '+db+' ==')
  for (const n of names) {
    const r = (await p.request().query(`SELECT [${fileCol}] AS f, [${timeCol}] AS t FROM yj_schema_log WHERE [${fileCol}] LIKE N'%${n.replace('.sql','')}%'`)).recordset
    console.log('  ' + n + ' → ' + (r.length ? r.map(x=>x.t).join(' , ') : '(未登记)'))
  }
  const f = (await p.request().query("SELECT SUM(CASE WHEN label=N'批号' THEN 1 ELSE 0 END) AS pi, SUM(CASE WHEN label=N'批次号' THEN 1 ELSE 0 END) AS pici FROM yj_field")).recordset[0]
  const pi = (await p.request().query("SELECT col_name, place, seq FROM yj_field WHERE panel_code=N'PURCHASE_IN' AND label IN (N'批号',N'批次号')")).recordset
  console.log('  全库 yj_field:批号 '+f.pi+' 行 / 批次号 '+f.pici+' 行 ; PURCHASE_IN 命中: '+JSON.stringify(pi))
  await p.close()
}
