/**
 * 补齐「该月销售订单 → 生产工单」的覆盖(2026-10-14,正式库,只走平台 API)
 *
 * 背景:用户要求「确保生产工单对应该月销售订单,并且符合日期是单据日期」。
 *   实测:本月销售订单 253 张,其中 221 张已有工单,**32 张没有**(43 行、35573 数量、占用=0),
 *   但它们**不出现在订单结转页** —— 结转页的取数条件把这类单漏掉了(具体条件未定位;
 *   页面口径 = 已审核 + 剩余>0,这两条它们都满足,所以另有隐情)。
 *   ⇒ 不依赖结转页:直接用同一支平台接口 `orderConvert/toManu` 按行结转(与页面点「转工单」同一条路),
 *     行身份(订单号/行id)从库里取,数量给剩余量;工艺路线沿用 GY-CB-STD。
 *   结转后补 `plang.pl_date` = 销售订单.单据日期(面板改不动该列,直接改库,与本批前面的处理一致)。
 *
 * 用法: node tools/archive/_complete-so-to-manu-1014.mjs [--dry] [--from 2026-09-01]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const DRY = argv.includes('--dry')
const BASE = 'http://127.0.0.1:8090'
const ROUTE = 'GY-CB-STD'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
// 本月「没有工单」的销售订单行(占用=0 或缺行),按订单+行给 toManu
const rows = await q(`
  SELECT o.单据编号 AS soNo, l.id AS lineId, l.数量 AS qty, CONVERT(varchar(10), o.单据日期, 120) AS soDate
  FROM bd_so_order o
  JOIN bl_so_order l ON l.单据编号 = o.单据编号 AND ISNULL(l.asp_cancel,'N') <> 'Y'
  WHERE o.asp_user1 = N'金蝶拉取' AND o.单据日期 >= '${FROM}'
    AND NOT EXISTS (SELECT 1 FROM plang p WHERE p.od_no = o.单据编号)
    AND l.数量 > 0
  ORDER BY o.单据日期, o.单据编号, l.id`)
await pool.close()
console.log(`待结转行 = ${rows.length}(涉及订单 ${new Set(rows.map((r) => r.soNo)).size} 张)`)
if (DRY) { rows.slice(0, 5).forEach((r) => console.log(`  ${r.soNo} 行${r.lineId} 数量=${r.qty} 订单日期=${r.soDate}`)); process.exit(0) }

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())

// 分批(每批 20 行)结转,避免单次请求过大/超时
let created = 0
const failed = []
for (let i = 0; i < rows.length; i += 20) {
  const batch = rows.slice(i, i + 20).map((r) => ({ 订单号: r.soNo, 行id: String(r.lineId), 工艺路线: ROUTE, 生单数量: r.qty }))
  const res = await post('/api/px/orderConvert/toManu', { rows: batch })
  if (res.code === 200 || res.code === 0) {
    created += (res.data && res.data['生成张数']) || 0
    const f = (res.data && res.data['失败行']) || []
    if (f.length) failed.push(...f)
    console.log(`  批 ${Math.floor(i / 20) + 1}: 生成 ${(res.data || {})['生成张数']} 张,失败 ${f.length} 行`)
  } else {
    failed.push(...batch.map((b) => b.订单号 + ':' + (res.message || '').slice(0, 40)))
    console.log(`  批 ${Math.floor(i / 20) + 1}: 整体失败 ${(res.message || '').slice(0, 60)}`)
  }
}
console.log(`结转生成 ${created} 张;失败行 ${failed.length}`)

// 补 pl_date = 销售订单日期(面板改不动该列,直接改库;与本批前面处理一致)
const pool2 = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const upd = await pool2.request().query(`
  UPDATE p SET p.pl_date = o.单据日期
  FROM plang p JOIN bd_so_order o ON o.单据编号 = p.od_no
  WHERE p.od_no IS NOT NULL AND CONVERT(varchar(10), p.pl_date, 120) <> CONVERT(varchar(10), o.单据日期, 120)`)
const cov = (await pool2.request().query(`
  SELECT (SELECT COUNT(*) FROM bd_so_order WHERE asp_user1=N'金蝶拉取' AND 单据日期>='${FROM}') AS 订单,
         (SELECT COUNT(DISTINCT o.单据编号) FROM bd_so_order o JOIN plang p ON p.od_no=o.单据编号 WHERE o.asp_user1=N'金蝶拉取' AND o.单据日期>='${FROM}') AS 有工单`)).recordset[0]
const mismatch = (await pool2.request().query(`
  SELECT COUNT(*) AS n FROM plang p JOIN bd_so_order o ON o.单据编号=p.od_no
  WHERE CONVERT(varchar(10),p.pl_date,120) <> CONVERT(varchar(10),o.单据日期,120)`)).recordset[0].n
await pool2.close()
console.log(`pl_date 补正行数 = ${upd.rowsAffected[0]};日期仍不一致 = ${mismatch}`)
console.log(`覆盖率:有工单订单 ${cov.有工单} / 本月订单 ${cov.订单}`)
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/so-to-manu-coverage-1014.md', import.meta.url),
  [`# 销售订单 → 生产工单 覆盖率补齐`, '', `- 时间:${new Date().toISOString()}  库:HSDZ_MES(正式)`,
    `- 待结转行 ${rows.length};生成 ${created} 张;失败行 ${failed.length}`,
    `- pl_date 补正 ${upd.rowsAffected[0]} 行;日期仍不一致 ${mismatch}`,
    `- 覆盖率:${cov.有工单}/${cov.订单}`, '', '## 失败行', '', ...(failed.length ? failed.slice(0, 40).map((x) => '- ' + x) : ['(无)'])].join('\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/so-to-manu-coverage-1014.md')
