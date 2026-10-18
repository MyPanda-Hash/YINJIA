/**
 * _check-qc-cols.mjs — 查 qc_insp_detail 是否缺「品质复核人」列(两账套),定位失败的迁移
 * 用法: set YINJIA_SQL_PASS=Yinjia@2026 && node tools/archive/_stockreport-dialog-1020/_check-qc-cols.mjs
 */
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const require = createRequire(join(ROOT, 'tools', 'package.json'))
let mssql
try { mssql = require('mssql') } catch { mssql = null }
if (!mssql) { console.log('未安装 mssql 模块,改用 JDBC 探针'); process.exit(2) }

const cfgBase = {
  server: '127.0.0.1', port: 1433, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}
for (const database of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  try {
    const pool = await new mssql.ConnectionPool({ ...cfgBase, database }).connect()
    const r = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='qc_insp_detail' ORDER BY ORDINAL_POSITION`)
    const cols = r.recordset.map((x) => x.COLUMN_NAME)
    console.log(`[${database}] qc_insp_detail ${cols.length} 列 | 含「品质复核人」= ${cols.includes('品质复核人')}`)
    console.log('   ' + cols.join(','))
    const head = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='qc_insp_head' AND COLUMN_NAME IN (N'品质复核人',N'复核人',N'复核结果')`)
    console.log('   qc_insp_head 复核相关列: ' + (head.recordset.map((x) => x.COLUMN_NAME).join(',') || '(无)'))
    await pool.close()
  } catch (e) {
    console.log(`[${database}] 查询失败: ${e.message}`)
  }
}
