/**
 * _q-panel-shape.mjs — 只读:yj_panel 列名 + 库存类面板的数据源/字段(STOCK_STATUS 等)
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-panel-shape.mjs [库名] [面板编码…]
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.argv[2] || 'HSDZ_MES'
const codes = process.argv.slice(3)
const base = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database
const pool = await mssql.connect({
  server: base.server, port: base.port, database: db, user: base.user, password: base.password,
  options: { encrypt: false, trustServerCertificate: true }, pool: { max: 4, min: 0, idleTimeoutMillis: 5000 },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
const show = (t, rows) => {
  console.log(`\n===== ${t} =====`)
  if (!rows.length) { console.log('(空)'); return }
  for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' | '))
}

console.log(`### 库 ${db}`)
show('yj_panel 列', await q(`SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id`))

if (codes.length) {
  const inList = codes.map((c) => `N'${c.replace(/'/g, "''")}'`).join(',')
  show('面板行', await q(`SELECT * FROM dbo.yj_panel WHERE code IN (${inList})`))
  show('字段(前 40)', await q(`SELECT * FROM dbo.yj_field WHERE panel_code IN (${inList}) ORDER BY panel_code, seq`))
}
await pool.close()
