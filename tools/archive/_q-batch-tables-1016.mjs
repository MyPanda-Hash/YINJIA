import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const NO = 'CGRK-20261007-03355'
// 找哪些表有 批次号/批号 列,且含这单
const tables = await q(`SELECT t.name AS tbl FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
  WHERE c.name IN (N'批次号', N'批号', N'批号编号') ORDER BY t.name`)
console.log('含批号列的表: ' + tables.map((t) => t.tbl).join(', '))
for (const { tbl } of tables) {
  const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${tbl}') AND c.name IN (N'批次号',N'批号',N'批号编号')`)).map((c) => c.name)
  const hasCol = (n) => (await q(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('${tbl}') AND name=N'${n}'`))[0].n > 0
  let where = null, idcol = null
  for (const candidate of ['单据编号', '来源单号', '单号', '源单号']) {
    if (await hasCol(candidate)) {
      const n = (await q(`SELECT COUNT(*) AS n FROM ${tbl} WHERE [${candidate}] = N'${NO}'`))[0].n
      if (n) { where = `[${candidate}] = N'${NO}'`; idcol = candidate; break }
    }
  }
  if (!where) continue
  console.log(`=== ${tbl}(${idcol}) ===`)
  for (const r of await q(`SELECT TOP 5 ${idcol}, ${cols.map((c) => '[' + c + ']').join(', ')} FROM ${tbl} WHERE ${where}`)) console.log('   ' + JSON.stringify(r))
}
await pool.close()
