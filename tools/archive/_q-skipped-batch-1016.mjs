import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options:{ encrypt:false, trustServerCertificate:true } })
const q = async (s) => (await pool.request().query(s)).recordset
const PAT = "LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'"
for (const t of ['bl_manu_order','bl_stock_close','erp_imp_log','erp_imp_row','plang','plang_pc','scjl','wo_progress','wo_transfer_log']) {
  const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${t}') AND c.name IN (N'批号',N'批次号')`)).map(c=>c.name)
  for (const c of cols) {
    const r = (await q(`SELECT COUNT(*) AS n FROM ${t} WHERE [${c}] ${PAT}`))[0].n
    if (r) console.log('   ' + t + '.' + c + ' 日期后缀批号 = ' + r + ' 行(该表无日期列,需人工确认口径)')
  }
}
console.log('   (以上未列出者 = 无日期后缀批号,无需处理)')
await pool.close()