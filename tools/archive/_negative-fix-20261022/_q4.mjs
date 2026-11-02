/** 只读探针 ④:其他入库单头/行结构、审核状态表、单据号规则 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')
const cols = async (t) => (await q(`SELECT COLUMN_NAME c, DATA_TYPE t, CHARACTER_MAXIMUM_LENGTH l, IS_NULLABLE n, NUMERIC_PRECISION p, NUMERIC_SCALE s
                                      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`))
  .map((x) => `${x.c}:${x.t}${x.l > 0 ? '(' + x.l + ')' : x.t === 'decimal' ? '(' + x.p + ',' + x.s + ')' : ''}${x.n === 'NO' ? '!' : ''}`)

line('bd_other_in 列')
console.log('  ' + (await cols('bd_other_in')).join('  '))
line('bl_other_in 列')
console.log('  ' + (await cols('bl_other_in')).join('  '))

line('bd_other_in 行数 / 样例')
for (const r of await q(`SELECT COUNT(*) AS n FROM bd_other_in`)) console.log('   总行数 ' + r.n)
for (const r of await q(`SELECT TOP 5 * FROM bd_other_in ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))
line('bl_other_in 行数 / 样例')
for (const r of await q(`SELECT COUNT(*) AS n FROM bl_other_in`)) console.log('   总行数 ' + r.n)
for (const r of await q(`SELECT TOP 3 * FROM bl_other_in ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))

line('yj_doc_status 列 + 样例')
console.log('  ' + (await cols('yj_doc_status')).join('  '))
for (const r of await q(`SELECT TOP 6 * FROM yj_doc_status ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))
line('yj_doc_status 按面板统计')
for (const r of await q(`SELECT panel_code, status, COUNT(*) AS n FROM yj_doc_status GROUP BY panel_code, status ORDER BY n DESC`)) console.log('   ' + JSON.stringify(r))

line('yj_form_approval 列')
console.log('  ' + (await cols('yj_form_approval')).join('  '))
for (const r of await q(`SELECT TOP 4 * FROM yj_form_approval ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))

line('s_allno 单据号规则(OTHER_IN 相关)')
console.log('  ' + (await cols('s_allno')).join('  '))
for (const r of await q(`SELECT * FROM s_allno WHERE 单号 LIKE '%QRK%' OR 单号 LIKE '%QTRK%' OR 单号 LIKE '%CGRK%' OR 1=0 OR 1=1`)) console.log('   ' + JSON.stringify(r))

line('yj_doc_batch 列')
console.log('  ' + (await cols('yj_doc_batch')).join('  '))

line('bs_wh 列 + 数据')
for (const r of await q(`SELECT * FROM bs_wh`)) console.log('   ' + JSON.stringify(r))

await pool.close()
