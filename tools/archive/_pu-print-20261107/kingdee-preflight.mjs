/**
 * 金蝶采购/销售订单「从 2026-10-01 至今」同步前预检(2026-11-09)—— **只读,不写库**。
 *
 * 目的:
 *   ① 数金蝶区间内到底有多少张已审核采购/销售订单;
 *   ② 本地已有多少张(按单据编号比对),差集 = 真正要补拉的;
 *   ③ 确认本地已有单据被生单链(form_flow_link)/材料码(bd_pu_label)引用的情况 ——
 *      这决定了能不能"整单重插"(重插会换行 id,挂在这些 id 上的引用会断)。
 *
 * 用法(仓库根):
 *   node tools/archive/_pu-print-20261107/kingdee-preflight.mjs                 # 默认正式库 HSDZ_MES
 *   node tools/archive/_pu-print-20261107/kingdee-preflight.mjs --db HSDZ_MES_TEST
 *   node tools/archive/_pu-print-20261107/kingdee-preflight.mjs --from 2026-10-01 --to 2026-11-09
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt }
const DB = arg('db', 'HSDZ_MES')
const FROM = arg('from', '2026-10-01')
const TO = arg('to', new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const fromMs = String(new Date(FROM + 'T00:00:00+08:00').getTime())
const toMs = String(new Date(TO + 'T23:59:59+08:00').getTime())

const TYPES = [
  { kd: 'pur_order', name: '采购订单', head: 'bd_pu_order' },
  { kd: 'sal_order', name: '销售订单', head: 'bd_so_order' },
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

console.log(`# 预检 目标库=${DB} 区间=${FROM} ~ ${TO}(金蝶只读)`)
for (const t of TYPES) {
  const rows = []
  for (let page = 1; page <= 400; page++) {
    const r = await kingdeeTryGet(cfg, token, `/jdy/v2/scm/${t.kd}`, {
      bill_status: 'C', page: String(page), page_size: '50',
      create_start_time: fromMs, create_end_time: toMs,
    })
    if (!r.ok) { console.log(`- ❌ ${t.name} 列表第 ${page} 页失败:${String(r.error).slice(0, 120)}`); break }
    const got = r.data.rows || []
    rows.push(...got)
    if (got.length < 50) break
    await new Promise((res) => setTimeout(res, 120))
  }
  const inRange = rows.filter((x) => x.bill_date && x.bill_date >= FROM && x.bill_date <= TO)
  const local = await pool.request().query(
    `SELECT 单据编号 FROM ${t.head} WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '${FROM}' AND 单据日期 <= '${TO}'`)
  const localSet = new Set(local.recordset.map((r) => String(r['单据编号']).trim()))
  const kdNos = inRange.map((x) => String(x.bill_no).trim())
  const missing = kdNos.filter((n) => !localSet.has(n))
  const extra = [...localSet].filter((n) => !kdNos.includes(n))
  console.log(`\n## ${t.name}`)
  console.log(`- 金蝶区间内已审核:${inRange.length} 张`)
  console.log(`- 本地区间内:${localSet.size} 张`)
  console.log(`- 本地缺(金蝶有、本地无):**${missing.length}** 张${missing.length ? ' —— ' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' …' : '') : ''}`)
  console.log(`- 本地多(本地有、金蝶区间无):${extra.length} 张${extra.length ? ' —— ' + extra.slice(0, 5).join(', ') : ''}`)
  if (t.kd === 'pur_order') {
    const link = await pool.request().query(
      `SELECT COUNT(*) AS n FROM form_flow_link WHERE source_line_key IN (`
        + `SELECT 单据编号 + N'#' + CONVERT(nvarchar(20), id) FROM bl_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' `
        + `AND 单据编号 IN (SELECT 单据编号 FROM bd_pu_order WHERE 单据日期 >= '${FROM}'))`)
    const label = await pool.request().query(
      `SELECT COUNT(*) AS n FROM bl_pu_label WHERE 采购订单行id IN (`
        + `SELECT l.id FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号 WHERE h.单据日期 >= '${FROM}')`)
    console.log(`- ⚠ 本地这些采购订单行已被引用:生单链 ${link.recordset[0].n} 条 / 材料码明细 ${label.recordset[0].n} 条`
      + ` ⇒ 已有单据**不能整单重插**(会换行 id 断引用),只能"只补缺"`)
  }
}
await pool.close()
