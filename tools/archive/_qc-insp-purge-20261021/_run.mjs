/*
 * _run.mjs — 执行一个 .sql 脚本(按 GO 分批,带事务由脚本自己管),首件/制程空壳草稿清理用。
 * 用法: node tools/archive/_qc-insp-purge-20261021/_run.mjs <db> <sql文件> [--dry]
 *   --dry 只打印每批语句,不执行。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const DB = process.argv[2] || 'HSDZ_MES'
const FILE = process.argv[3]
const DRY = process.argv.includes('--dry')
if (!FILE) { console.error('用法: node _run.mjs <db> <sql文件> [--dry]'); process.exit(2) }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
console.log(`[db] ${DB}  脚本 ${FILE}${DRY ? '  (DRY RUN)' : ''}`)

const sql = fs.readFileSync(FILE, 'utf8')
const batches = sql.split(/\nGO\r?\n/).map((s) => s.trim()).filter(Boolean)
let i = 0
let failed = false
for (const b of batches) {
  i++
  const head = b.replace(/\s+/g, ' ').slice(0, 110)
  if (DRY) { console.log(`  [${i}/${batches.length}] ${head}`); continue }
  console.log(`\n── 批 ${i}/${batches.length}: ${head} …`)
  try {
    const req = new mssql.Request(pool)
    req.on('info', (msg) => console.log('   ' + String(msg.message || '').trim()))
    const r = await req.query(b)
    for (const set of r.recordsets || []) {
      if (!set.length) continue
      console.log('   ' + Object.keys(set[0]).join(' | '))
      for (const row of set) {
        console.log('   ' + Object.values(row).map((v) => (v === null ? '<null>' : String(v).trim())).join(' | '))
      }
    }
  } catch (e) {
    console.error(`   [ERROR] ${e.message}`)
    failed = true
    break
  }
}
await pool.close()
if (failed) { console.error('\n[FAILED] 脚本中止(已执行的分批不会自动回滚,脚本内事务会整体回滚)'); process.exit(1) }
console.log('\n[OK] 全部批次执行完成')
