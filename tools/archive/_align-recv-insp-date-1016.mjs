/**
 * 送料暂收单 / 来料检验单 的日期改为「源订单(采购订单)的单据日期」(2026-10-16,正式库)
 * 用户口径:「来料检验单和送料暂收单按源订单的单据日期来做修改」。
 *   · 送料暂收单 sl_recv.单据日期      = 其 采购订单号 → bd_pu_order.单据日期
 *   · 来料检验单 qc_insp.单据日期      = 其 暂收单号 → sl_recv.采购订单号 → bd_pu_order.单据日期
 * 同时把可派生的 创建时间/转ERP时间(若存在)按原列型一并跟随(与上一轮金蝶单据口径一致)。
 * 用法: node tools/archive/_align-recv-insp-date-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const hasCol = async (t, c) => (await q(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('${t}') AND name=N'${c}'`))[0].n > 0

const before = await q(`SELECT TOP 6 i.单据编号, CONVERT(varchar(10),i.单据日期,120) AS 检验单日期, ISNULL(sl.采购订单号,N'') AS 采购订单, CONVERT(varchar(10),o.单据日期,120) AS 订单日期 FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号 LEFT JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE o.单据编号 IS NOT NULL ORDER BY i.id DESC`)
console.log('改前样例(检验单):')
for (const r of before) console.log('   ' + JSON.stringify(r))

const cnt = async (sql) => (await q(sql))[0].n
const slDiff = await cnt(`SELECT COUNT(*) AS n FROM sl_recv sl JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE CONVERT(date,sl.单据日期)<>CONVERT(date,o.单据日期)`)
const ijDiff = await cnt(`SELECT COUNT(*) AS n FROM qc_insp i JOIN sl_recv sl ON sl.单据编号=i.暂收单号 JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE CONVERT(date,i.单据日期)<>CONVERT(date,o.单据日期)`)
console.log(`待改:送料暂收单 ${slDiff} 张 / 来料检验单 ${ijDiff} 张`)
if (DRY) process.exit(0)

const nSl = (await pool.request().query(`UPDATE sl SET 单据日期 = o.单据日期 FROM sl_recv sl JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号 WHERE CONVERT(date, sl.单据日期) <> CONVERT(date, o.单据日期)`)).rowsAffected[0]
const nIj = (await pool.request().query(`UPDATE i SET 单据日期 = o.单据日期 FROM qc_insp i JOIN sl_recv sl ON sl.单据编号 = i.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号 WHERE CONVERT(date, i.单据日期) <> CONVERT(date, o.单据日期)`)).rowsAffected[0]
console.log(`已改:送料暂收单 ${nSl} 行 / 来料检验单 ${nIj} 行`)

// 创建时间/转ERP时间 跟随(两表若有这两列)
for (const [t, join] of [
  ['sl_recv', `FROM sl_recv x JOIN bd_pu_order o ON o.单据编号 = x.采购订单号`],
  ['qc_insp', `FROM qc_insp x JOIN sl_recv sl ON sl.单据编号 = x.暂收单号 JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号`],
]) {
  for (const c of ['创建时间', '转ERP时间']) {
    if (!(await hasCol(t, c))) continue
    const isDate = (await q(`SELECT ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('${t}') AND c.name=N'${c}'`))[0].typ
    const setExpr = ['date', 'datetime', 'datetime2', 'smalldatetime', 'timestamp'].includes(isDate) ? 'o.单据日期' : `CONVERT(varchar(19), o.单据日期, 120)`
    const cond = isDate ? `CONVERT(date, x.[${c}]) <> CONVERT(date, o.单据日期)` : `LEFT(x.[${c}], 10) <> CONVERT(varchar(10), o.单据日期, 120)`
    const n = (await pool.request().query(`UPDATE x SET [${c}] = ${setExpr} ${join} WHERE x.[${c}] IS NOT NULL AND ${cond}`)).rowsAffected[0]
    if (n) console.log(`   ${t}.${c} 跟随 ${n} 行`)
  }
}

const after = await q(`SELECT TOP 6 i.单据编号, CONVERT(varchar(10),i.单据日期,120) AS 检验单日期, CONVERT(varchar(10),o.单据日期,120) AS 订单日期, CASE WHEN CONVERT(date,i.单据日期)=CONVERT(date,o.单据日期) THEN N'一致' ELSE N'不一致' END AS 结果 FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号 LEFT JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE o.单据编号 IS NOT NULL ORDER BY i.id DESC`)
console.log('改后样例(检验单):')
for (const r of after) console.log('   ' + JSON.stringify(r))
const left1 = await cnt(`SELECT COUNT(*) AS n FROM sl_recv sl JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE CONVERT(date,sl.单据日期)<>CONVERT(date,o.单据日期)`)
const left2 = await cnt(`SELECT COUNT(*) AS n FROM qc_insp i JOIN sl_recv sl ON sl.单据编号=i.暂收单号 JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE CONVERT(date,i.单据日期)<>CONVERT(date,o.单据日期)`)
console.log(`复核:仍不一致 —— 暂收单 ${left1} / 检验单 ${left2}`)
writeFileSync(new URL('./_dump-out/align-recv-insp-date-before-1016.json', import.meta.url), JSON.stringify(before, null, 1), 'utf8')
await pool.close()
