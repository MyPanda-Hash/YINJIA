/**
 * _dump-schema.mjs — 摘 erp_imp_log / erp_imp_row 的列定义(只读,取证用)
 * 输出:schema.json(同目录),供生成补录 SQL 用。
 */
import { writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.env.YINJIA_SQL_DB || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})

const cols = await pool.request().query(`
  SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length AS len,
         c.is_nullable AS nullable, c.is_identity AS is_id, c.column_id AS ord
  FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE t.name IN ('erp_imp_log','erp_imp_row')
  ORDER BY t.name, c.column_id`)

const log = await pool.request().query('SELECT * FROM erp_imp_log ORDER BY id')
const row = await pool.request().query('SELECT * FROM erp_imp_row ORDER BY 批次号, 行号')
await pool.close()

writeFileSync(new URL('./schema.json', import.meta.url), JSON.stringify({
  db: DB,
  columns: cols.recordset,
  logCount: log.recordset.length,
  rowCount: row.recordset.length,
  log: log.recordset,
  row: row.recordset,
}, null, 2), 'utf8')
console.log(`done ${DB}: log=${log.recordset.length} row=${row.recordset.length}`)
