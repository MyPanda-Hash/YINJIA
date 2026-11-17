// 清理:删掉走查时写入测试库(HSDZ_MES_TEST)的「扫码混料」草稿行(标记 N)
// 只动 GD-2026-11-0015 #1 + YJ-TJHZ-001 这一条,先打印再删,最后复核。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire('D:/YINJIA-main/deploy/')
const mssql = require('mssql')
const cfg = JSON.parse(readFileSync('D:/YINJIA-main/deploy/config.json', 'utf8'))
const db = process.argv[2] || cfg.database.database

const pool = await mssql.connect({
  server: cfg.database.server, port: cfg.database.port, database: db,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: false, trustServerCertificate: true },
})

const WHERE = "工单号 = N'GD-2026-11-0015' AND 工单行号 = 1 AND 物料编号 = N'YJ-TJHZ-001' AND 标记 = N'N'"
const before = (await pool.request().query(
  `SELECT id, 工单号, 工单行号, 物料编号, 实际用量, 标记, 单据编号 FROM dbo.wo_mixing_list WHERE ${WHERE}`)).recordset
console.log('db =', db, ' 待清理:', JSON.stringify(before))

const guards = before.filter((r) => String(r['单据编号'] || '').trim() !== '')
if (guards.length) {
  console.log('发现已挂单据编号的行,拒绝删除:', JSON.stringify(guards))
  await pool.close()
  process.exit(1)
}

const del = await pool.request().query(`DELETE FROM dbo.wo_mixing_list WHERE ${WHERE}`)
console.log('已删除行数:', del.rowsAffected)

const after = (await pool.request().query(
  `SELECT COUNT(1) AS n FROM dbo.wo_mixing_list WHERE ${WHERE}`)).recordset
console.log('复核剩余:', JSON.stringify(after))
await pool.close()
