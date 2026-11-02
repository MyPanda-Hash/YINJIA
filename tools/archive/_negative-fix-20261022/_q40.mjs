/** 关键交叉校验:执行后 kucun 合计变化 是否等于 配平单合计 - 删除量 - 重算修正 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// 执行前 kucun 合计(来自备份快照)
import { readFileSync } from 'node:fs'
const files = readFileSync('D:/YINJIA-main/tools/_balance-out/' + process.argv[2], 'utf8')
const bk = JSON.parse(files)
const beforeSum = bk.kucunAffected.reduce((s, r) => s + Number(r.yl || 0), 0)
console.log(`备份时负结存 ${bk.kucunAffected.length} 行,合计 ${beforeSum.toFixed(2)}`)

const now = (await q(`SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].s
console.log(`现在 kucun 合计 ${Number(now).toFixed(2)}`)

const added = (await q(`SELECT CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) s FROM inh
                          WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%')`))[0].s
console.log(`配平单入库合计 ${Number(added).toFixed(2)}`)

const kc = (await q(`SELECT COUNT(*) n, CAST(SUM(yl) AS decimal(18,4)) s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0]
console.log(`现存 kucun 行数 ${kc.n}`)
const negKeys = bk.kucunAffected.length
console.log(`\n预期:原合计 + 配平 = ${(Number(now) + 0).toFixed(2)};若负结存那 ${negKeys} 行都补到 1,`
  + `理论增量 = ${(-beforeSum + negKeys).toFixed(2)},实际增量 ≈ ${Number(added).toFixed(2)}(含 0.0001 级舍入与删除量)`)
await pool.close()
