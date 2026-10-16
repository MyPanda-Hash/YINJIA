/**
 * _q-warn-anatomy.mjs —— 库存预警构成解剖 + CP-02 身份确认 + 阈值口径一致性(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-warn-anatomy.mjs [db] [whCode]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const WH = process.argv[3] || 'CP-02'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log(`== 「${WH}」是谁(仓库档案 bs_wh)==`)
const wh = await q(`SELECT 仓库编码, 仓库名称, ISNULL(仓库地址,'') AS addr FROM bs_wh WHERE 仓库编码 = N'${WH}'`)
console.log(wh.length ? '  ' + JSON.stringify(wh[0]) : '  (bs_wh 里没有这个编码)')

console.log(`\n== 预警构成(kucun,与 PortalNotificationService.alarms 同条件)==`)
const comp = (await q(`SELECT
    SUM(CASE WHEN yl IS NOT NULL AND yl < ISNULL(NULLIF([预警数量],0),50) THEN 1 ELSE 0 END) AS 命中预警,
    SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS 其中负结存,
    SUM(CASE WHEN yl >= 0 THEN 1 ELSE 0 END) AS 其中非负_真低库存,
    SUM(CASE WHEN yl < 0 AND ckdm = N'${WH}' THEN 1 ELSE 0 END) AS 负结存在CP02,
    SUM(CASE WHEN yl >= 0 AND ISNULL([预警数量],0) > 0 THEN 1 ELSE 0 END) AS 真低库存且设了阈值
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl IS NOT NULL`))[0]
console.log('  ' + JSON.stringify(comp))

console.log(`\n== 负结存按仓库分布 ==`)
for (const r of await q(`SELECT ckdm, COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,1)) AS 合计结余
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl < 0 GROUP BY ckdm ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.ckdm).padEnd(10)} ${String(r.行数).padStart(4)} 行  合计 ${r.合计结余}`)

console.log(`\n== 负结存的来源可疑度:该(存货,仓库,批号)有没有入库流水 ==`)
const neg = await q(`SELECT TOP 12 k.wzdm, k.ckdm, k.lot_no, k.yl,
    (SELECT COUNT(*) FROM inh i WHERE i.wzdm = k.wzdm AND i.ckdm = k.ckdm) AS inh行,
    (SELECT COUNT(*) FROM outh o WHERE o.wzdm = k.wzdm AND o.ckdm = k.ckdm) AS outh行
  FROM kucun k WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND k.yl < 0 ORDER BY k.yl`)
for (const r of neg) console.log(`  ${String(r.wzdm).padEnd(14)} ${String(r.ckdm).padEnd(8)} 批号=${String(r.lot_no || '(空)').padEnd(12)} 结余=${String(r.yl).padStart(10)} 入库流水 ${r.inh行} 行 / 出库流水 ${r.outh行} 行`)

console.log(`\n== 阈值口径 ==`)
console.log('  PortalNotificationService 用的是 ISNULL(NULLIF(预警数量,0),50) —— 未设阈值回退 50')
console.log('  出库审批闸门(StockWarnService)用的是该批次预警数量,未设=0 ⇒ 等价"不许负结存"')
const set = await q(`SELECT TOP 8 wzdm, ckdm, lot_no, yl, [预警数量] FROM kucun WHERE ISNULL([预警数量],0) > 0 ORDER BY [预警数量] DESC`)
for (const r of set) console.log(`   设了阈值的样例: ${r.wzdm} @${r.ckdm} 批号${r.lot_no || '(空)'} 结余 ${r.yl} 阈值 ${r.预警数量}`)
await pool.close()
