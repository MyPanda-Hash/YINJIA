/**
 * _pending-migrations.mjs — 只读:清单里哪些脚本还没登记/内容变了(判断 DbSync 默认同步会不会动手)
 * 用途:新增迁移脚本后,先看清单与 yj_schema_log 的差集,再决定敢不敢跑默认同步。
 * 用法: node tools/archive/_erplg-push-20261019/_pending-migrations.mjs [--db HSDZ_MES]
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const TOOLS = new URL('../../', import.meta.url).pathname.replace(/^\//, '')

const lines = readFileSync(new URL('../../db-migrations.txt', import.meta.url), 'utf8').split(/\r?\n/)
const scripts = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && /\.sql$/i.test(l))

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const logged = new Map((await pool.request().query('SELECT script_name, content_hash FROM yj_schema_log')).recordset
  .map((r) => [r.script_name, r.content_hash.trim()]))
await pool.close()

const missing = [], changed = [], nofile = []
for (const s of scripts) {
  let buf
  try { buf = readFileSync(new URL('../../' + s, import.meta.url)) } catch { nofile.push(s); continue }
  const h = createHash('sha256').update(buf).digest('hex')
  const old = logged.get(s)
  if (!old) missing.push(s)
  else if (old !== h) changed.push(s)
}
console.log(`库=${DB} 清单脚本=${scripts.length}`)
console.log(`未登记(会被执行)=${missing.length}`)
missing.slice(0, 30).forEach((s) => console.log('  + ' + s))
console.log(`内容变了(会被重跑)=${changed.length}`)
changed.slice(0, 30).forEach((s) => console.log('  ~ ' + s))
console.log(`清单里有但文件缺失=${nofile.length}`)
nofile.slice(0, 10).forEach((s) => console.log('  ! ' + s))
