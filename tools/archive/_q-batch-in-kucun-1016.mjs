import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const NO = 'CGRK-20261007-03355'
console.log('=== 库存明细/流水里出现该批号的地方 ===')
// kucun 库存表
try {
  const cols = (await q("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('kucun')")).map((c) => c.name)
  const batchCols = cols.filter((c) => /批/.test(c))
  const noCols = cols.filter((c) => /单号|单据/.test(c))
  console.log(`   kucun: 批号列=[${batchCols.join(',')}] 单号列=[${noCols.join(',')}]`)
  if (batchCols.length) {
    for (const r of await q(`SELECT TOP 6 * FROM kucun WHERE [${batchCols[0]}] LIKE N'SX-20261014%'`)) console.log('   批号 SX-20261014 的行: ' + JSON.stringify({ 存货编码: r['存货编码'], [batchCols[0]]: r[batchCols[0]], 数量: r['数量'] }))
  }
} catch (e) { console.log('   kucun 查询: ' + e.message.slice(0, 60)) }
// inh / outh 流水
for (const t of ['inh', 'outh']) {
  try {
    const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${t}')`)).map((c) => c.name)
    const bc = cols.filter((c) => /批/.test(c))
    const nc = cols.filter((c) => /单号|单据/.test(c))
    console.log(`   ${t}: 批号列=[${bc.join(',')}] 单号列=[${nc.join(',')}]`)
    for (const r of await q(`SELECT TOP 4 ${nc[0]}, ${bc.map((c) => '[' + c + ']').join(',')} FROM ${t} WHERE [${nc[0]}] = N'${NO}'`)) console.log(`      ${t} ` + JSON.stringify(r))
  } catch (e) { console.log(`   ${t}: ${e.message.slice(0, 60)}`) }
}
// 行表
for (const t of ['bl_purchase_in']) {
  const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${t}')`)).map((c) => c.name)
  const bc = cols.filter((c) => /批/.test(c))
  console.log(`   ${t}: 批号列=[${bc.join(',')}]`)
  const sel = ['单据编号', '物料编码', ...bc].map((c) => '[' + c + ']').join(',')
  for (const r of await q(`SELECT TOP 4 ${sel} FROM ${t} WHERE 单据编号 = N'${NO}'`)) console.log('      ' + JSON.stringify(r))
}
// 单据头
for (const r of await q(`SELECT 单据编号, ISNULL(批次号,N'') AS 头批次, 单据日期 FROM bd_purchase_in WHERE 单据编号 = N'${NO}'`)) console.log('   单据头: ' + JSON.stringify(r))
await pool.close()
