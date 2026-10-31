// _q-write-probe.cjs — 检查批量写库验证在测试账套动过的两张工单现状(只读)
// 用法: node tools/archive/_batch-sched-20261030/_q-write-probe.cjs
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql')

;(async () => {
  const db = await mssql.connect({
    server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  })
  const q = async (sql) => (await db.request().query(sql)).recordset
  const nos = `N'GD2608260013',N'GD2608190010'`
  console.log('== plang')
  for (const x of await q(`SELECT id, pl_no, pl_xc, ISNULL(scx,N'') scx, ISNULL(pl_sl,0) pl_sl, ISNULL(yl,0) yl,
      CONVERT(varchar(19),st_date,120) st_date, CONVERT(varchar(19),cp_date,120) cp_date,
      ISNULL(当前工序,N'') cur_op, ISNULL(完工状态,N'') done, ISNULL(ja,N'N') ja,
      CONVERT(varchar(19),asp_time2,120) asp_time2
      FROM dbo.plang WHERE pl_no IN (${nos}) AND ISNULL(asp_cancel,N'N')<>N'Y'`)) console.log(x)
  console.log('\n== wo_process_line (未作废)')
  for (const x of await q(`SELECT id, 工单号, 工单行id, 工序, 工序序, 计划生产线, 计划数量,
      CONVERT(varchar(10),计划开工日期,120) 开工, CONVERT(varchar(10),计划完工日期,120) 完工, 状态,
      CONVERT(varchar(19),asp_time1,120) 建, ISNULL(asp_cancel,N'N') cancel
      FROM dbo.wo_process_line WHERE 工单号 IN (${nos}) ORDER BY 工单号, 工序序, id`)) console.log(x)
  console.log('\n== plang_pc')
  for (const x of await q(`SELECT id, pl_no, pl_xc, plang_id, ISNULL(scx,N'') scx, ISNULL(pl_sl,0) pl_sl,
      CONVERT(varchar(19),asp_time1,120) 建, CONVERT(varchar(19),asp_time2,120) 改, ISNULL(asp_cancel,N'N') cancel
      FROM dbo.plang_pc WHERE pl_no IN (${nos}) ORDER BY pl_no, id`)) console.log(x)
  console.log('\n== scjl 报工')
  for (const x of await q(`SELECT gldh, COUNT(*) n, SUM(CASE WHEN ISNULL(asp_cancel,N'N')<>N'Y' THEN 1 ELSE 0 END) alive,
      MAX(CONVERT(varchar(10),sc_date,120)) last_date
      FROM dbo.scjl WHERE gldh IN (${nos}) GROUP BY gldh`)) console.log(x)
  console.log('\n== 待排产池')
  for (const x of await q(`SELECT pl_no, pl_xc, ISNULL(scx,N'') scx FROM dbo.plang
      WHERE ISNULL(asp_cancel,N'N')<>N'Y' AND ISNULL(scx,N'')=N'' ORDER BY id`)) console.log(x)
  await db.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
