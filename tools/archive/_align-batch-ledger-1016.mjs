/**
 * 批号对齐(2026-10-16,正式库):把「日期后缀批号」的日期段改成该行的**单据日期**
 * 用户反馈:库存明细里 CGRK-20261007-03355 的批号仍是 SX-20261014(拉取日),与单据日期 10-07 不一致。
 * 覆盖:入库流水 inh / 出库流水 outh / 各类单据行表(批号、批次号)。
 * 规则:批号形如 `前缀-yyyyMMdd`(结尾 8 位数字)时,把日期段替换为**该单据/该行的单据日期**;
 *       非日期形态的批号(如 PC0000、金蝶批次)原样不动。
 * 用法: node tools/archive/_align-batch-ledger-1016.mjs
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const run = async (label, sql) => {
  try { console.log(`   ${label}: ${(await pool.request().query(sql)).rowsAffected[0]} 行`) }
  catch (e) { console.log(`   ${label}: 跳过(${e.message.slice(0, 50)})`) }
}
const PAT = `LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`

console.log('=== 库存流水 inh / outh(按本行单据日期)===')
for (const t of ['inh', 'outh']) {
  await run(`${t}.批号`, `UPDATE ${t} SET 批号 = LEFT(批号, LEN(批号)-8) + CONVERT(varchar(8), 单据日期, 112)
    WHERE 批号 ${PAT} AND 单据日期 IS NOT NULL AND RIGHT(批号, 8) <> CONVERT(varchar(8), 单据日期, 112)`)
}
console.log('=== 单据行表(按头表单据日期)===')
const LINE = [
  ['bl_purchase_in', 'bd_purchase_in'], ['bl_sale_out', 'bd_sale_out'], ['bl_material_out', 'bd_material_out'],
  ['bl_finish_in', 'bd_finish_in'], ['bl_other_in', 'bd_other_in'], ['bl_other_out', 'bd_other_out'],
  ['bl_pu_order', 'bd_pu_order'], ['bl_so_order', 'bd_so_order'],
]
for (const [line, head] of LINE) {
  for (const c of ['批号', '批次号']) {
    await run(`${line}.${c}`, `UPDATE l SET l.[${c}] = LEFT(l.[${c}], LEN(l.[${c}])-8) + CONVERT(varchar(8), h.单据日期, 112)
      FROM ${line} l JOIN ${head} h ON h.单据编号 = l.单据编号
      WHERE l.[${c}] ${PAT} AND h.单据日期 IS NOT NULL AND RIGHT(l.[${c}], 8) <> CONVERT(varchar(8), h.单据日期, 112)`)
  }
}
console.log('=== 复核(日期后缀批号与单据日期不一致的行数,应为 0)===')
for (const t of ['inh', 'outh']) {
  const r = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${t} WHERE 批号 ${PAT} AND 单据日期 IS NOT NULL AND RIGHT(批号,8) <> CONVERT(varchar(8), 单据日期, 112)`)).recordset[0].n
  console.log(`   ${t}: ${r}`)
}
for (const [line, head] of LINE) {
  const r = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${line} l JOIN ${head} h ON h.单据编号=l.单据编号 WHERE l.批号 ${PAT} AND h.单据日期 IS NOT NULL AND RIGHT(l.批号,8) <> CONVERT(varchar(8), h.单据日期, 112)`)).recordset[0].n
  if (r) console.log(`   ${line}: ${r}`)
}
console.log('   样例:')
for (const r of (await pool.request().query(`SELECT TOP 4 单据编号, 批号, CONVERT(varchar(10), 单据日期, 120) AS 单据日期 FROM inh WHERE 批号 ${PAT} ORDER BY id DESC`)).recordset) console.log('      inh ' + JSON.stringify(r))
await pool.close()
