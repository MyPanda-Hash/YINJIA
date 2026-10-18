/**
 * _q-wo-contract.mjs —— 造报工数据前:报工单面板登记了哪些字段 + 完工明细视图怎么算(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-wo-contract.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }

console.log('== WO_REPORT 面板登记字段(label → col_name) ==')
for (const r of await q(`SELECT seq, label, col_name, place FROM yj_field WHERE panel_code = N'WO_REPORT' ORDER BY seq`))
  console.log(`  ${String(r.seq).padStart(4)} ${String(r.label).padEnd(16)} ${String(r.col_name).padEnd(16)} ${r.place}`)

console.log('\n== WO_REPORT_LIST / WO_COMPLETION_LIST 登记字段 ==')
for (const p of ['WO_REPORT_LIST', 'WO_COMPLETION_LIST']) {
  const rs = await q(`SELECT seq, label, col_name, place FROM yj_field WHERE panel_code = N'${p}' ORDER BY seq`)
  console.log(`  【${p}】${typeof rs === 'string' ? rs : rs.map((r) => r.label + '(' + r.col_name + ')').join(', ')}`)
}

console.log('\n== v_wo_completion_detail 定义(完工明细怎么算出来) ==')
const def = await q(`SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.v_wo_completion_detail')) AS d`)
console.log(typeof def === 'string' ? def : (def[0]?.d || '(视图不存在)').slice(0, 2600))

console.log('\n== scjl 现有 7 行长什么样(照它的样子造) ==')
for (const r of await q(`SELECT TOP 3 * FROM scjl`)) console.log('  ' + JSON.stringify(r).slice(0, 700))

console.log('\n== 号池 s_allno 结构 + BG 现状 ==')
console.log('  列: ' + JSON.stringify((await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.s_allno')`)).map?.((x) => x.name) ?? 'ERR'))
console.log('  ' + JSON.stringify(await q(`SELECT TOP 10 * FROM s_allno ORDER BY 1 DESC`)).slice(0, 600))
await pool.close()
