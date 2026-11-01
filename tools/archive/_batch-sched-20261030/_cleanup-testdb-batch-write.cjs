// _cleanup-testdb-batch-write.cjs — 清理「批量排产写库验证」在测试账套留下的痕迹(2026-11-01)
//
// 为什么需要:写库验证排产了 GD2608260013#1 / GD2608190010#1 两行(预排台账/排产记录/plang 排产线),
// 这两行**本来就有旧报工**(scjl 2026-08-26),后端撤销排产守卫以「已有报工进度」拒绝撤销 ⇒
// 无法走 /unassign 回池,只能按本次写入的时间戳精确作废(测试账套,只动这两张单、只动本次新建的行)。
//
// 安全闸门:DB_NAME() 必须是 HSDZ_MES_TEST;只处理这两张工单 + 本次时间窗(2026-10-31 起)新建的行;
// 幂等(已作废的不重复动);不改任何报工/库存/其它单。
// 已知残留(无法还原,如实记录):plang.cp_date 被排产写成预完工日 2026-11-01(原交期未留痕);
//   plang.asp_user2/asp_time2 留排产审计时间 —— 测试账套可接受。
//
// 用法: node tools/archive/_batch-sched-20261030/_cleanup-testdb-batch-write.cjs
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql')

const NOS = ["GD2608260013", "GD2608190010"]
const PLANG_IDS = [12, 25]

;(async () => {
  const db = await mssql.connect({
    server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  })
  const one = async (sql) => (await db.request().query(sql)).recordset[0]
  const dbName = (await one('SELECT DB_NAME() AS n')).n
  if (dbName !== 'HSDZ_MES_TEST') {
    console.error(`[拒绝] 只允许在测试账套执行,当前 DB=${dbName}`)
    process.exit(2)
  }
  const nosSql = NOS.map((n) => `N'${n}'`).join(',')
  const idsSql = PLANG_IDS.join(',')

  console.log('清理前: 待排产池(scx 空) =', (await one("SELECT COUNT(*) n FROM dbo.plang WHERE ISNULL(asp_cancel,N'N')<>N'Y' AND ISNULL(scx,N'')=N''")).n)
  console.log('        未作废预排台账 =', (await one(`SELECT COUNT(*) n FROM dbo.wo_process_line WHERE 工单号 IN (${nosSql}) AND ISNULL(asp_cancel,N'N')<>N'Y'`)).n)
  console.log('        未作废排产记录 =', (await one(`SELECT COUNT(*) n FROM dbo.plang_pc WHERE pl_no IN (${nosSql}) AND ISNULL(asp_cancel,N'N')<>N'Y'`)).n)

  // ① 作废本次新建的预排台账(时间窗 = 本次写入之后;之前这些单没有台账)
  const r1 = await db.request().query(`
    UPDATE w SET asp_cancel='Y', asp_user2=N'batch-cleanup', asp_time2=GETDATE()
    FROM dbo.wo_process_line w
    WHERE w.工单号 IN (${nosSql}) AND ISNULL(w.asp_cancel,N'N')<>N'Y'
      AND w.asp_time1 >= '2026-10-31 00:00:00' AND w.asp_time1 < '2026-11-02'`)
  console.log('作废预排台账行数 =', r1.rowsAffected[0])

  // ② 作废本次新建的排产记录 plang_pc(同上,同一时间窗)
  const r2 = await db.request().query(`
    UPDATE pc SET asp_cancel='Y', asp_user2=N'batch-cleanup', asp_time2=GETDATE()
    FROM dbo.plang_pc pc
    WHERE pc.pl_no IN (${nosSql}) AND ISNULL(pc.asp_cancel,N'N')<>N'Y'
      AND pc.asp_time1 >= '2026-10-31 00:00:00' AND pc.asp_time1 < '2026-11-02'`)
  console.log('作废排产记录行数 =', r2.rowsAffected[0])

  // ③ 工单行回到待排产:清排产线/排产人/预开工/余量(排产前 scx 为空、未指派产线)
  const r3 = await db.request().query(`
    UPDATE p SET scx=N'', pl_man=NULL, st_date=NULL, yl=NULL,
                 asp_user2=N'batch-cleanup', asp_time2=GETDATE()
    FROM dbo.plang p
    WHERE p.id IN (${idsSql}) AND ISNULL(p.asp_cancel,N'N')<>N'Y'`)
  console.log('回池工单行数 =', r3.rowsAffected[0])

  console.log('清理后: 待排产池(scx 空) =', (await one("SELECT COUNT(*) n FROM dbo.plang WHERE ISNULL(asp_cancel,N'N')<>N'Y' AND ISNULL(scx,N'')=N''")).n)
  console.log('        未作废预排台账 =', (await one(`SELECT COUNT(*) n FROM dbo.wo_process_line WHERE 工单号 IN (${nosSql}) AND ISNULL(asp_cancel,N'N')<>N'Y'`)).n)
  console.log('        未作废排产记录 =', (await one(`SELECT COUNT(*) n FROM dbo.plang_pc WHERE pl_no IN (${nosSql}) AND ISNULL(asp_cancel,N'N')<>N'Y'`)).n)
  console.log('残留(如实): plang.cp_date 仍是排产时写的预完工日、asp_user2/asp_time2 留审计时间;报工 scjl 未动。')
  await db.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
