/**
 * 批号补齐(第二轮,2026-10-16,正式库):把全库所有「日期后缀批号」的日期段对齐到对应单据日期
 * 第一轮只覆盖 inh/outh/bl_purchase_in;全库盘点后仍不一致:
 *   inv_cost_ledger.批号 1027 / sl_recv.批次号 116 / qc_insp.批次号 11 / qc_return.批次号 1
 *   + 13 张无日期列的表(sl_recv_detail、qc_insp_detail 等)需经头表关联
 * 日期来源解析:① 本表 单据日期;② 头表(bl_X→bd_X,X_detail→X,X_head→X);③ 送料暂收单→采购订单日期;④ 成本台账用其自身日期列
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const PAT = `LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`
const colsOf = async (t) => (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${t}')`)).map((r) => r.name)
const exists = async (t) => (await q(`SELECT COUNT(*) AS n FROM sys.tables WHERE name='${t}'`))[0].n > 0

const tabs = (await q(`SELECT DISTINCT t.name AS tbl FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id WHERE c.name IN (N'批号',N'批次号') ORDER BY t.name`)).map((r) => r.tbl)
let fixed = 0
for (const tbl of tabs) {
  const cols = await colsOf(tbl)
  const bcols = ['批号', '批次号'].filter((c) => cols.includes(c))
  const noCol = ['单据编号', '单号', '来源单号'].find((c) => cols.includes(c))
  // 解析日期表达式(别名 x = 本表)
  let dateExpr = cols.includes('单据日期') ? 'x.[单据日期]' : null
  let join = ''
  if (!dateExpr && cols.includes('日期')) dateExpr = 'x.[日期]'
  if (!dateExpr && cols.includes('发生日期')) dateExpr = 'x.[发生日期]'
  if (!dateExpr && noCol) {
    const cands = []
    if (tbl.startsWith('bl_')) cands.push('bd_' + tbl.slice(3))
    if (/_detail$/.test(tbl)) cands.push(tbl.replace(/_detail$/, ''))
    if (/_head$/.test(tbl)) cands.push(tbl.replace(/_head$/, ''))
    if (tbl === 'qc_insp_detail') { cands.length = 0; cands.push('qc_insp') }
    for (const h of cands) {
      if (!(await exists(h))) continue
      const hc = await colsOf(h)
      if (!hc.includes('单据日期')) continue
      join = `JOIN ${h} h ON h.单据编号 = x.[${noCol}]`
      dateExpr = 'h.[单据日期]'
      break
    }
  }
  // 送料暂收单及其明细:直接取采购订单日期
  if (tbl === 'sl_recv') { join = `JOIN bd_pu_order po ON po.单据编号 = x.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (tbl === 'sl_recv_detail') { join = `JOIN sl_recv s ON s.单据编号 = x.单据编号 JOIN bd_pu_order po ON po.单据编号 = s.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (tbl === 'qc_insp') { join = `JOIN sl_recv s ON s.单据编号 = x.暂收单号 JOIN bd_pu_order po ON po.单据编号 = s.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (!dateExpr) { console.log(`   ${tbl}: 无日期来源,跳过`); continue }
  for (const c of bcols) {
    try {
      const n = (await pool.request().query(`UPDATE x SET x.[${c}] = LEFT(x.[${c}], LEN(x.[${c}])-8) + CONVERT(varchar(8), ${dateExpr}, 112)
        FROM ${tbl} x ${join}
        WHERE x.[${c}] ${PAT} AND ${dateExpr} IS NOT NULL AND RIGHT(x.[${c}], 8) <> CONVERT(varchar(8), ${dateExpr}, 112)`)).rowsAffected[0]
      if (n) { console.log(`   ${tbl}.${c}: 修 ${n} 行`); fixed += n }
    } catch (e) { console.log(`   ${tbl}.${c}: 失败 ${e.message.slice(0, 60)}`) }
  }
}
console.log(`\n本轮共修 ${fixed} 行`)
// 复核
let badTotal = 0
for (const tbl of tabs) {
  const cols = await colsOf(tbl)
  const bcols = ['批号', '批次号'].filter((c) => cols.includes(c))
  const noCol = ['单据编号', '单号', '来源单号'].find((c) => cols.includes(c))
  let dateExpr = cols.includes('单据日期') ? 'x.[单据日期]' : null, join = ''
  if (!dateExpr && cols.includes('日期')) dateExpr = 'x.[日期]'
  if (!dateExpr && noCol) {
    const cands = []
    if (tbl.startsWith('bl_')) cands.push('bd_' + tbl.slice(3))
    if (/_detail$/.test(tbl)) cands.push(tbl.replace(/_detail$/, ''))
    for (const h of cands) { if (await exists(h)) { const hc = await colsOf(h); if (hc.includes('单据日期')) { join = `JOIN ${h} h ON h.单据编号 = x.[${noCol}]`; dateExpr = 'h.[单据日期]'; break } } }
  }
  if (tbl === 'sl_recv') { join = `JOIN bd_pu_order po ON po.单据编号 = x.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (tbl === 'sl_recv_detail') { join = `JOIN sl_recv s ON s.单据编号 = x.单据编号 JOIN bd_pu_order po ON po.单据编号 = s.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (tbl === 'qc_insp') { join = `JOIN sl_recv s ON s.单据编号 = x.暂收单号 JOIN bd_pu_order po ON po.单据编号 = s.采购订单号`; dateExpr = 'po.[单据日期]' }
  if (!dateExpr) continue
  for (const c of bcols) {
    const n = (await q(`SELECT COUNT(*) AS n FROM ${tbl} x ${join} WHERE x.[${c}] ${PAT} AND ${dateExpr} IS NOT NULL AND RIGHT(x.[${c}],8) <> CONVERT(varchar(8), ${dateExpr}, 112)`))[0].n
    if (n) { console.log(`   仍不一致 ${tbl}.${c} = ${n}`); badTotal += n }
  }
}
console.log(`复核:全库日期后缀批号仍不一致 = ${badTotal}`)
await pool.close()
