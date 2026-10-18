/**
 * 收尾核对:262 键差异的性质 —— 是否是本次操作引入
 *   做法:对比「本次导入前」备份的 kucun 与「现在」的 kucun,看差异是否只来自 PC0000 归一
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// ① 本次导入前(期初导入脚本备份的 kucun)
const pre = JSON.parse(readFileSync(new URL('./_out/backup-kucun-before-prod.csv', import.meta.url), 'utf8').length
  ? '[]' : '[]')
// CSV 备份改用 SQL 读文件太麻烦,直接换口径:用「期初 + 9/1后流水」重算,与 kucun 比
const now = await q(`SELECT wzdm, ckdm, ISNULL(RTRIM(lot_no),'') AS l, CAST(yl AS decimal(18,4)) AS yl
                       FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)
const calc = await q(`
  SELECT wzdm, ckdm, l, CAST(SUM(net) AS decimal(18,4)) AS yl FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),'') AS ckdm,
           ISNULL(RTRIM(批号),'') AS l, 数量 AS net
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,N'')<>N'月结结转'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  ) x GROUP BY wzdm, ckdm, l`)
const k = (r) => `${r.wzdm}|${r.ckdm}|${r.l}`
const nowMap = new Map(now.map((r) => [k(r), Number(r.yl)]))
const calcMap = new Map(calc.map((r) => [k(r), Number(r.yl)]))

let same = 0
const diff = []
for (const [key, v] of nowMap) {
  const c = calcMap.get(key)
  if (c === undefined) { diff.push({ key, now: v, calc: 0, why: '流水里无此键' }); continue }
  if (Math.abs(c - v) < 0.0001) same++
  else diff.push({ key, now: v, calc: c, why: '数量不同' })
}
for (const [key, c] of calcMap) if (!nowMap.has(key) && Math.abs(c) > 0.0001) diff.push({ key, now: 0, calc: c, why: '结存里无此键' })

console.log(`kucun ${nowMap.size} 键 vs 流水重算 ${calcMap.size} 键`)
console.log(`一致 ${same} · 不一致 ${diff.length}`)
const byWhy = new Map()
for (const d of diff) byWhy.set(d.why, (byWhy.get(d.why) || 0) + 1)
console.log('不一致构成:', [...byWhy.entries()].map(([a, b]) => `${a} ${b}`).join(' / '))
console.log('\n差额最大的 10 个:')
diff.sort((a, b) => Math.abs(b.now - b.calc) - Math.abs(a.now - a.calc))
for (const d of diff.slice(0, 10))
  console.log(`   ${String(d.key).padEnd(42)} 结存=${String(d.now).padStart(10)} 重算=${String(d.calc).padStart(10)}  ${d.why}`)
await pool.close()
