/**
 * 把 PC0000 行备份成 JSON(两账套),供归一后还原/核对
 */
import { writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const TARGETS = [
  ['kucun', `RTRIM(ISNULL(lot_no,'')) = N'PC0000'`],
  ['inh', `RTRIM(ISNULL(批号,'')) = N'PC0000'`],
  ['outh', `RTRIM(ISNULL(批号,'')) = N'PC0000'`],
]

for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
    password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
  for (const [t, cond] of TARGETS) {
    const r = (await pool.request().query(`SELECT * FROM ${t} WHERE ${cond}`)).recordset
    const tag = db === 'HSDZ_MES' ? 'prod' : 'test'
    const f = new URL(`./_out/backup-pc0000-${tag}-${t}.json`, import.meta.url)
    writeFileSync(f, JSON.stringify(r))
    console.log(`${db.padEnd(14)} ${t.padEnd(6)} ${String(r.length).padStart(5)} 行 → _out/backup-pc0000-${tag}-${t}.json`)
  }
  await pool.close()
}
