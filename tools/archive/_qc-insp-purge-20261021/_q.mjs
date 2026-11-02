/*
 * _q.mjs — 临时查询器(只读/可执行任意语句),首件与制程检验单清理取证用。
 * 用法: node tools/archive/_qc-insp-purge-20261021/_q.mjs <db> <sql文件>
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const DB = process.argv[2] || 'HSDZ_MES'
const FILE = process.argv[3]
const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const sql = fs.readFileSync(FILE, 'utf8')
for (const chunk of sql.split(/\nGO\r?\n/)) {
  const s = chunk.trim()
  if (!s) continue
  console.log(`\n=== ${s.replace(/\s+/g, ' ').slice(0, 120)} ===`)
  try {
    const r = await new mssql.Request(pool).query(s)
    const sets = r.recordsets || []
    for (const set of sets) {
      if (!set.length) { console.log('(空结果集)'); continue }
      console.log(Object.keys(set[0]).join(' | '))
      for (const row of set.slice(0, 60)) {
        console.log(Object.values(row).map((v) => (v === null ? '<null>' : String(v).trim())).join(' | '))
      }
      console.log(`[rows] ${set.length}`)
    }
  } catch (e) {
    console.log('[ERROR] ' + e.message)
  }
}
await pool.close()
