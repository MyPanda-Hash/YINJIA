// _q-pending.cjs — 批量排产 UI 验证前的一次性只读探针(2026-10-30):
// 两账套「待排产池」(plang.scx 空、未作废)的工单行 + 单据日期 + 工艺路线,
// 用于确认 e2e 该选哪两行、是否落在生产工单页默认 15 天窗口内。
// 用法: node tools/archive/_batch-sched-20261030/_q-pending.cjs
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql')

;(async () => {
  for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
    const p = await mssql.connect({
      server: '127.0.0.1', port: 1433, database: db, user: 'yinjia', password: 'Yinjia@2026',
      options: { encrypt: false, trustServerCertificate: true },
    })
    const r = await p.request().query(`
      SELECT p.pl_no, p.pl_xc, CONVERT(varchar(10), p.pl_date, 120) AS d,
             ISNULL(p.scx, N'') AS line, ISNULL(p.xq_sl, 0) AS demand, ISNULL(p.pl_sl, 0) AS sched,
             ISNULL(p.[工艺路线], N'') AS route, ISNULL(p.ja, N'N') AS ja, ISNULL(p.完工状态, N'') AS done
      FROM dbo.plang p
      WHERE ISNULL(p.asp_cancel, N'N') <> N'Y' AND ISNULL(p.scx, N'') = N''
      ORDER BY p.id`)
    console.log('== ' + db + ' 待排产行数: ' + r.recordset.length)
    for (const x of r.recordset) {
      console.log([x.pl_no, x.pl_xc, x.d, x.line, x.demand, x.sched, x.route, x.ja, x.done].join(' | '))
    }
    await p.close()
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
