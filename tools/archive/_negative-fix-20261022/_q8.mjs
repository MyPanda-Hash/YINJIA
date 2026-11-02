/** 只读探针 ⑧:既有其他入库单的完整落库足迹(头/行/状态/留痕/流水/成本) */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('yj_form_approval 中 OTHER_IN 的留痕')
for (const r of await q(`SELECT * FROM yj_form_approval WHERE panel_code='OTHER_IN' ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))
line('yj_form_approval 全样(其它面板,参考)')
for (const r of await q(`SELECT TOP 5 * FROM yj_form_approval ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))

line('yj_doc_status 中 OTHER_IN 全字段')
for (const r of await q(`SELECT * FROM yj_doc_status WHERE panel_code='OTHER_IN' ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))

line('两张库存相关报表/成本表是否含其他入库')
for (const r of await q(`SELECT TABLE_NAME t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%inv_cost%' OR TABLE_NAME LIKE '%cost%'`)) console.log('   ' + r.t)

line('yj_usage_log 中 OTHER_IN')
for (const r of await q(`SELECT TOP 5 * FROM yj_usage_log WHERE panel_code='OTHER_IN' ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r))

line('单据号是否回登号池')
for (const r of await q(`SELECT TOP 5 * FROM s_allno WHERE dh LIKE 'QTRK%' OR lb='QTRK'`)) console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT COUNT(*) n FROM s_allno WHERE dh LIKE 'QTRK%'`)) console.log('   号池 QTRK 记录数: ' + r.n)
for (const r of await q(`SELECT COUNT(*) n, MAX(dh) mx FROM s_allno WHERE dh LIKE 'CGRK%'`)) console.log('   号池 CGRK 记录数: ' + r.n + ' max=' + r.mx)

line('全部单据号前缀(inh)')
for (const r of await q(`SELECT LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) AS pfx, COUNT(*) AS n FROM inh GROUP BY LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1)`))
  console.log(`   ${String(r.pfx).padEnd(12)} ${r.n}`)

await pool.close()
