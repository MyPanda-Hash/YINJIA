// _q-write-state.cjs — 只读:批量写库验证动过的两张工单当前状态 + 待排产池计数
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql')

;(async () => {
  const db = await mssql.connect({
    server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  })
  const q = async (sql) => (await db.request().query(sql)).recordset
  const nos = "N'GD2608260013',N'GD2608190010'"
  console.log('plang:')
  for (const x of await q(`SELECT id, pl_no, pl_xc, ISNULL(scx,N'') scx, ISNULL(pl_sl,0) pl_sl, ISNULL(yl,0) yl,
      ISNULL(pl_man,N'') pl_man, ISNULL(lb,N'') lb, CONVERT(varchar(10),st_date,120) st,
      CONVERT(varchar(10),cp_date,120) cp, CONVERT(varchar(19),asp_time2,120) t2
      FROM dbo.plang WHERE pl_no IN (${nos})`)) console.log(x)
  console.log('wo_process_line:')
  for (const x of await q(`SELECT 工单号, 工序, 计划数量, CONVERT(varchar(19),asp_time1,120) t1, ISNULL(asp_cancel,N'N') c
      FROM dbo.wo_process_line WHERE 工单号 IN (${nos}) ORDER BY 工单号, 工序序`)) console.log(x)
  console.log('plang_pc:')
  for (const x of await q(`SELECT pl_no, pl_xc, CONVERT(varchar(19),asp_time1,120) t1, ISNULL(asp_cancel,N'N') c
      FROM dbo.plang_pc WHERE pl_no IN (${nos})`)) console.log(x)
  console.log('pool count(scx empty):', (await q("SELECT COUNT(*) n FROM dbo.plang WHERE ISNULL(asp_cancel,N'N')<>N'Y' AND ISNULL(scx,N'')=N''"))[0].n)
  await db.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
