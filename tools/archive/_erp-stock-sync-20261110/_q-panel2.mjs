/**
 * _q-panel2.mjs — 只读:库存类面板 + STOCK_STATUS 字段
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-panel2.mjs [库名]
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.argv[2] || 'HSDZ_MES'
const base = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database
const pool = await mssql.connect({
  server: base.server, port: base.port, database: db, user: base.user, password: base.password,
  options: { encrypt: false, trustServerCertificate: true }, pool: { max: 4, min: 0, idleTimeoutMillis: 5000 },
})
const q = async (s) => (await pool.request().query(s)).recordset
const dump = (rows) => { for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' | ')) }

console.log(`### 库 ${db} 库存类面板`)
dump(await q(`SELECT panel_code,panel_name,category,mode,line_table,head_table,pk_col,code_col
  FROM dbo.yj_panel WHERE panel_name LIKE N'%库存%' OR panel_name LIKE N'%盘点%' OR panel_name LIKE N'%调拨%'
  ORDER BY panel_code`))

const f = await q(`SELECT label,col_name,data_type,place,seq,visible,hidden FROM dbo.yj_field
  WHERE panel_code = 'STOCK_STATUS' ORDER BY seq`)
console.log(`\n### STOCK_STATUS 字段 ${f.length} 行`)
dump(f)
await pool.close()
