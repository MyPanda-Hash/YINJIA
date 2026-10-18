/**
 * _q-run-sql.mjs —— 把一段 SQL 文件按 GO 切分逐批执行并把**完整**错误抛出来(调试用,只读不改库时也能用)
 * 用法: node _q-run-sql.mjs <sqlFile> [batchIndex]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import fs from 'node:fs'

const file = process.argv[2]
const only = process.argv[3] ? Number(process.argv[3]) : null
const raw = fs.readFileSync(file, 'utf8')
const batches = raw.split(/\r?\n/).reduce((acc, l) => {
  if (/^\s*GO(\s+\d+)?\s*$/i.test(l)) acc.push('')
  else { acc[acc.length - 1] += l + '\n' }
  return acc
}, ['']).map((s) => s.trim()).filter(Boolean)

console.log(`文件 ${file}:${batches.length} 批`)
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: process.env.YINJIA_SQL_DB || 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
for (let i = 0; i < batches.length; i++) {
  if (only !== null && i !== only) continue
  console.log(`\n────── 批 ${i + 1}(${batches[i].length} 字符)──────`)
  const onInfo = (m) => console.log('  [msg]', String(m.message).trim())
  pool.on('info', onInfo)
  try {
    const r = await pool.request().batch(batches[i])
    console.log('OK  rowsAffected=', JSON.stringify(r.rowsAffected))
    for (const m of (r.recordsets || [])) if (Array.isArray(m)) console.log(JSON.stringify(m).slice(0, 1500))
  } catch (e) {
    console.log('FAIL', e.code, e.number, e.message)
    console.log('       line', e.lineNumber, 'state', e.state)
  } finally {
    pool.removeListener('info', onInfo)
  }
}
await pool.close()
