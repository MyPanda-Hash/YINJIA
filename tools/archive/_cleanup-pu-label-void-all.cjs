/**
 * _cleanup-pu-label-void-all.cjs — 把**测试账套**里所有存活的材料码打印单一律作废(探针中断后的兜底清场)
 * 用法:node tools/archive/_cleanup-pu-label-void-all.cjs
 */
'use strict'
const { createRequire } = require('node:module')
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'

async function main() {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const rows = (await new mssql.Request(pool).query(
    `SELECT 单据编号 no FROM bd_pu_label WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id`)).recordset
  if (!rows.length) console.log(`${DB}:没有存活打印单`)
  for (const r of rows) {
    const j = await (await fetch(API + '/px/puLabel/void', {
      method: 'POST', headers: H, body: JSON.stringify({ docNo: String(r.no).trim() }),
    })).json()
    console.log(`  作废 ${String(r.no).trim()} → ${j.code} ${j.message || ''}`)
  }
  await pool.close()
}
main().catch((e) => { console.error('异常:' + (e && e.message || e)); process.exit(1) })
