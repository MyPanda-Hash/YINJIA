/** 在测试库造假数据,用于端到端验证 balance-negative-stock.js(只在 HSDZ_MES_TEST 执行) */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = 'HSDZ_MES_TEST'
if (!/TEST/.test(db)) { console.error('只允许在测试库执行'); process.exit(1) }
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 造数前 ===')
console.log(JSON.stringify(await q(`SELECT COUNT(*) n, CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`)))

// 取几个真实存在、且有出库的 (物料,仓库,批号)
const cands = await q(`
  SELECT TOP 3 RTRIM(o.物料编码) w, ISNULL(RTRIM(o.仓库编码),'') c, ISNULL(RTRIM(o.批号),'') l,
         MAX(CONVERT(varchar(10), o.单据日期,120)) lastOut, CAST(SUM(o.数量) AS decimal(18,2)) outq
    FROM outh o JOIN bs_inv i ON i.存货编码 = o.物料编码
   WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND o.单据日期 >= '2026-09-01'
   GROUP BY RTRIM(o.物料编码), ISNULL(RTRIM(o.仓库编码),''), ISNULL(RTRIM(o.批号),'')
  ORDER BY outq DESC`)

for (const k of cands) {
  console.log(`造负库存:${k.w} @ ${k.c} @ ${k.l || '(无)'} 最后一笔出库 ${k.lastOut}`)
  const ex = await q(`SELECT id FROM kucun WHERE RTRIM(wzdm)='${k.w}' AND ISNULL(RTRIM(ckdm),'')='${k.c}' AND ISNULL(RTRIM(lot_no),'')='${k.l}'`)
  if (ex.length) {
    await q(`UPDATE kucun SET yl = yl - 5000, ckl = ISNULL(ckl,0) + 5000 WHERE id = ${ex[0].id}`)
  } else {
    await q(`INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)
             VALUES (N'${k.w}', N'${k.c}', ${k.l ? `N'${k.l}'` : 'NULL'}, GETDATE(), 0, 5000, -5000, 'seed', GETDATE(), 'N')`)
  }
}

// 造一个测试物料
await q(`IF NOT EXISTS (SELECT 1 FROM inh WHERE 物料编码='TEST-MAT-SEED')
         INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量, asp_user1, asp_time1, asp_cancel)
         VALUES (1, 999001, 'TEST-SEED-001', N'采购入库单', '2026-09-16', N'TEST-MAT-SEED', N'YCL-01', NULL, 100, 'seed', GETDATE(), 'N')`)
await q(`IF NOT EXISTS (SELECT 1 FROM outh WHERE 物料编码='TEST-MAT-SEED')
         INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量, 单据金额, asp_user1, asp_time1, asp_cancel)
         VALUES (5, 999002, 'TEST-SEED-002', N'销售出库单', '2026-09-16', N'TEST-MAT-SEED', N'YCL-01', NULL, 30, 0, 'seed', GETDATE(), 'N')`)
await q(`IF NOT EXISTS (SELECT 1 FROM kucun WHERE wzdm='TEST-MAT-SEED')
         INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)
         VALUES (N'TEST-MAT-SEED', N'YCL-01', NULL, GETDATE(), 100, 30, 70, 'seed', GETDATE(), 'N')`)

console.log('\n=== 造数后 ===')
console.log(JSON.stringify(await q(`SELECT COUNT(*) n, CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`)))
for (const r of await q(`SELECT wzdm, ckdm, lot_no, CAST(yl AS decimal(18,2)) yl FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`))
  console.log('   负: ' + JSON.stringify(r))
for (const r of await q(`SELECT 'inh' t, 物料编码, 仓库编码, 数量 FROM inh WHERE 物料编码='TEST-MAT-SEED' UNION ALL SELECT 'outh', 物料编码, 仓库编码, 数量 FROM outh WHERE 物料编码='TEST-MAT-SEED'`))
  console.log('   测试物料: ' + JSON.stringify(r))

await pool.close()
