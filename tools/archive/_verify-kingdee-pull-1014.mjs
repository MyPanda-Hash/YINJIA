/**
 * 拉取验证(2026-10-14):对刚拉进 MES 的 8 类单据做两级核对。
 *
 *   ① 条数对账:金蝶「区间内(按单据日期)」条数 ↔ MES 里 asp_user1='金蝶拉取' 且 单据日期 在区间的条数
 *   ② 逐字段抽查:每类抽 3 张,拿金蝶详情与 MES 落库行**逐字段比对**(表头 + 首行明细)
 *
 * 用法: node tools/archive/_verify-kingdee-pull-1014.mjs [--db HSDZ_MES_TEST] [--from 2026-09-01] [--to 2026-10-14]
 * 产物: tools/archive/_dump-out/kingdee-pull-verify-<tag>-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES_TEST')
const FROM = arg('from', '2026-09-01')
const TO = arg('to', new Date().toISOString().slice(0, 10))
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'
const S = (v) => (v === undefined || v === null ? '' : String(v).trim())
const norm = (v) => { if (v instanceof Date) return v.toISOString().slice(0, 10); const s = S(v); return /^\d+\.0+$/.test(s) ? String(Number(s)) : s }

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fromMs = String(new Date(FROM + 'T00:00:00+08:00').getTime())
const toMs = String(new Date(TO + 'T23:59:59+08:00').getTime())

/** 每类:列表/详情接口、时间过滤键、目标表、幂等键列、抽查字段([金蝶键, MES 列, 'head'|'line']) */
const TYPES = [
  { kd: 'pur_order', kdName: '采购订单', head: 'bd_pu_order', line: 'bl_pu_order', keyCol: '外部数据ID', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['supplier_name', '供应商', 'head'], ['material_number', '物料编码', 'line'], ['qty', '数量', 'line'], ['price', '单价', 'line']] },
  { kd: 'sal_order', kdName: '销售订单', head: 'bd_so_order', line: 'bl_so_order', keyCol: '外部数据ID', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['customer_name', '客户', 'head'], ['material_number', '存货编码', 'line'], ['qty', '数量', 'line'], ['price', '单价', 'line']] },
  { kd: 'pur_inbound', kdName: '采购入库单', head: 'bd_purchase_in', line: 'bl_purchase_in', keyCol: '单据编号', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['supplier_name', '供应商', 'head'], ['material_number', '存货编码', 'line'], ['qty', '实收数量', 'line'], ['price', '单价', 'line']] },
  { kd: 'sal_out_bound', kdName: '销售出库单', head: 'bd_sale_out', line: 'bl_sale_out', keyCol: '单据编号', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['customer_name', '客户', 'head'], ['material_number', '存货编码', 'line'], ['qty', '数量', 'line'], ['price', '售价', 'line']] },
  { kd: 'inv_pick', kdName: '生产领料单', head: 'bd_material_out', line: 'bl_material_out', keyCol: '单据编号', timeKey: 'modify',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['dept_name', '生产车间', 'head'], ['material_number', '材料编码', 'line'], ['qty', '数量', 'line'], ['price', '单价', 'line']] },
  { kd: 'inv_product', kdName: '产品入库单', head: 'bd_finish_in', line: 'bl_finish_in', keyCol: '单据编号', timeKey: 'modify',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['dept_name', '部门', 'head'], ['material_number', '产品编码', 'line'], ['qty', '实收数量', 'line']] },
  { kd: 'inv_other_in', kdName: '其他入库单', head: 'bd_other_in', line: 'bl_other_in', keyCol: '外部数据ID', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['supplier_name', '供应商', 'head'], ['material_number', '存货编码', 'line'], ['qty', '数量', 'line']] },
  { kd: 'inv_other_out', kdName: '其他出库单', head: 'bd_other_out', line: 'bl_other_out', keyCol: '外部数据ID', timeKey: 'create',
    checks: [['bill_no', '单据编号', 'head'], ['bill_date', '单据日期', 'head'], ['dept_name', '部门', 'head'], ['material_number', '存货编码', 'line'], ['qty', '数量', 'line']] },
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

const out = []
const say = (s) => { out.push(s); console.log(s) }
say(`# 拉取验证(目标库 ${DB};区间 ${FROM} ~ ${TO})`)
say('')
say(`- 时间:${new Date().toISOString()}`)
say('')
say('## 一、条数对账')
say('')
say('| 单据 | 金蝶区间内 | MES 已拉取 | 一致 |')
say('|---|---|---|---|')
let bad = 0
const samples = {}
for (const t of TYPES) {
  const rows = []
  for (let page = 1; page <= 400; page++) {
    const r = await kingdeeTryGet(cfg, token, `/jdy/v2/scm/${t.kd}`, {
      bill_status: 'C', page: String(page), page_size: '50',
      [`${t.timeKey}_start_time`]: fromMs, [`${t.timeKey}_end_time`]: toMs,
    })
    if (!r.ok) break
    const got = r.data.rows || []
    rows.push(...got)
    if (got.length < 50) break
    await sleep(100)
  }
  const inRange = rows.filter((x) => x.bill_date && x.bill_date >= FROM && x.bill_date <= TO)
  const mes = (await pool.request().query(
    `SELECT COUNT(*) AS n FROM ${t.head} WHERE asp_user1 = N'金蝶拉取' AND 单据日期 >= '${FROM}' AND 单据日期 <= '${TO}'`)).recordset[0].n
  const okRow = Math.abs(inRange.length - mes) <= 0   // 严格相等
  if (!okRow) bad++
  say(`| ${t.kdName} | ${inRange.length} | ${mes} | ${okRow ? '✅' : '❌'} |`)
  samples[t.kd] = { t, bills: inRange.slice(0, 3).map((x) => ({ id: String(x.id), bill_no: x.bill_no })) }
  await sleep(150)
}

say('')
say('## 二、逐字段抽查(每类 3 张,表头 + 首行明细)')
say('')
let checked = 0, mismatch = 0
for (const [kd, { t, bills }] of Object.entries(samples)) {
  const lines = []
  for (const b of bills) {
    const d = (await kingdeeTryGet(cfg, token, `/jdy/v2/scm/${kd}_detail`, { id: b.id })).data || {}
    const head = (await pool.request().query(`SELECT * FROM ${t.head} WHERE 单据编号 = N'${S(d.bill_no).replace(/'/g, "''")}'`)).recordset[0] || {}
    const line = (await pool.request().query(`SELECT TOP 1 * FROM ${t.line} WHERE 单据编号 = N'${S(d.bill_no).replace(/'/g, "''")}' ORDER BY id`)).recordset[0] || {}
    const e0 = (d.material_entity || [])[0] || {}
    for (const [kdk, col, part] of t.checks) {
      const a = norm(part === 'head' ? d[kdk] : e0[kdk])
      const bv = norm(part === 'head' ? head[col] : line[col])
      checked++
      const same = a === bv || (a && bv && Number(a) === Number(bv) && !isNaN(Number(a)))
      if (!same) { mismatch++; lines.push(`| ${t.kdName} | ${S(d.bill_no)} | \`${kdk}\` | ${a.slice(0, 30)} | \`${col}\` | ${bv.slice(0, 30)} | ❌ |`) }
    }
    await sleep(120)
  }
  say(`- ${t.kdName}:抽查 ${bills.length} 张 × ${t.checks.length} 字段 —— ${lines.length === 0 ? '全部一致 ✅' : lines.length + ' 处不一致'}`)
  if (lines.length) {
    say('')
    say('| 单据 | 单号 | 金蝶键 | 金蝶值 | MES 列 | MES 值 | 一致 |')
    say('|---|---|---|---|---|---|---|')
    say(lines.join('\n'))
    say('')
  }
}
say('')
say('## 三、结论')
say('')
say(`- 条数对账:**${TYPES.length - bad}/${TYPES.length}** 类一致`)
say(`- 字段抽查:共比 ${checked} 项,**不一致 ${mismatch} 项**`)
say('')

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL(`./_dump-out/kingdee-pull-verify-${TAG}-1014.md`, import.meta.url), out.join('\n'), 'utf8')
await pool.close()
console.log(`\n条数不一致 ${bad} 类;字段不一致 ${mismatch} 项`)
console.log(`[产物] tools/archive/_dump-out/kingdee-pull-verify-${TAG}-1014.md`)
