/**
 * _q-inv-config.mjs —— 商品(INV)面板的"渲染行数从哪来"取证(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-inv-config.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query(
  `SELECT panel_code, mode, ISNULL(page_size,0) AS page_size, ISNULL(detail_key,'') AS detail_key,
          ISNULL(module_group,'') AS mg FROM yj_panel
    WHERE panel_code IN ('INV','TEAM','QC_RECV','WH') ORDER BY panel_code`)).recordset
console.log('== yj_panel（库侧分页配置）==')
for (const r of rows) console.log(`  ${r.panel_code}\tmode=${r.mode}\tpage_size=${r.page_size}\tdetail_key=${r.detail_key}\tmodule=${r.mg}`)
console.log(`  bs_inv 行数 = ${(await pool.request().query('SELECT COUNT(*) AS n FROM bs_inv')).recordset[0].n}`)
console.log(`  yj_field(INV) 登记字段数 = ${(await pool.request().query("SELECT COUNT(*) AS n FROM yj_field WHERE panel_code='INV'")).recordset[0].n}`)
await pool.close()

const B = (process.argv[3] || 'http://127.0.0.1:8090') + '/api'
const lg = JSON.parse(await (await fetch(B + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text()).data.token
const cfg = JSON.parse(await (await fetch(B + '/px/getPanelConfig?panelCode=INV', {
  headers: { Authorization: 'Bearer ' + lg },
})).text()).data
const tp = cfg.panelPageDto?.tablePages?.[0] || {}
console.log('\n== 前端拿到的配置 ==')
console.log(`  metadata.singleDoc = ${cfg.metadata?.singleDoc}`)
console.log(`  tablePages[0].pageSize = ${tp.pageSize}`)
console.log(`  dataSchema.fields = ${(cfg.dataSchema?.fields || []).length}`)
console.log(`  detail.tabs = ${(cfg.detail?.tabs || []).length}`)
