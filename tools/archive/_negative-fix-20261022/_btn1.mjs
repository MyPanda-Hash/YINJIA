/** 查特采单面板的按钮配置存哪 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== yj_panel 列的按钮相关字段 ===')
for (const r of await q(`SELECT COLUMN_NAME c, DATA_TYPE t FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_panel' ORDER BY ORDINAL_POSITION`))
  process.stdout.write(r.c + ' ')
console.log('')

console.log('\n=== QC_TC_IN 面板行 ===')
for (const r of await q(`SELECT * FROM yj_panel WHERE panel_code='QC_TC_IN'`)) console.log(JSON.stringify(r, null, 1).slice(0, 2500))
await pool.close()
