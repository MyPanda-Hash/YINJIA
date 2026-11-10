/**
 * _q-field-shape.mjs — 只读:yj_field / yj_translation 列与样例(STOCK_STATUS 新增字段前取证)
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-field-shape.mjs [库名]
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

for (const t of ['yj_field', 'yj_translation']) {
  console.log(`\n### ${t} 列`)
  dump(await q(`SELECT c.name AS 列名, ty.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空,
    COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS 自增
    FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.${t}') ORDER BY c.column_id`))
}

console.log('\n### yj_field 新增库存类字段的参照样例(最近一次给平表面板加字段)')
dump(await q(`SELECT TOP 3 * FROM dbo.yj_field WHERE panel_code = 'STOCK_BALANCE' ORDER BY seq DESC`))

console.log('\n### 现存量类字段已有的译名(复用同一批词条)')
dump(await q(`SELECT scope, ref_key, locale, text, source FROM dbo.yj_translation
  WHERE ref_key IN (N'金蝶数量', N'差异数量', N'金蝶同步时间', N'现存量', N'同步时间') ORDER BY ref_key, locale`))

await pool.close()
