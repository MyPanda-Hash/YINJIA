/**
 * 近一个月采购订单 → 送料暂收单 → 生单分流(2026-10-14,正式库)
 *
 * 口径(用户):「近一个月全部都要」+「按现有档案跑」(商品 bs_inv.来料检验=是 → 来料检验单,否则免检直达采购入库单)。
 * 前置(实测):
 *   ① 采购订单必须**真正已审核**(工作流派生状态),否则生单报「仅已审核单据可生单,当前状态:草稿」;
 *   ② 送料暂收单也要先审核才能生单;
 *   ③ 平台成功码 = **code 200**(不是 0)。
 * 只走平台 API,不直接写库。
 *
 * 用法: node tools/archive/_flow-po-to-receipt-1014.mjs [--base http://127.0.0.1:8090] [--db HSDZ_MES] [--from 2026-09-14] [--limit N]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const BASE = arg('base', 'http://127.0.0.1:8090')
const DB = arg('db', 'HSDZ_MES')
const FROM = arg('from', '2026-09-14')
const LIMIT = Number(arg('limit', '0')) || 0
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const POs = (await pool.request().query(
  `SELECT 单据编号 FROM bd_pu_order WHERE asp_user1 = N'金蝶拉取' AND 单据日期 >= '${FROM}' ORDER BY 单据日期, 单据编号`))
  .recordset.map((r) => r.单据编号)
await pool.close()
const todo = LIMIT ? POs.slice(0, LIMIT) : POs
console.log(`近一个月采购订单 ${todo.length} 张`)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(DB !== 'HSDZ_MES' ? { factory: 'YJ_TEST' } : {}) }),
})).json()
const token = login?.data?.token
if (!token) { console.log('❌ 登录失败'); process.exit(1) }
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())
const btn = async (p, name, fd) => post('/api/px/callButton', { panelCode: p, buttonName: name, formData: fd, buttonParam: {} })
const approve = async (p, no) => {
  await btn(p, '提交审批', { 编号: no, 单据编号: no })
  const a = await btn(p, '审批通过', { 编号: no, 单据编号: no })
  return a.code === 200 || a.code === 0
}

const rows = []
let okSl = 0, okGen = 0, skip = 0, bad = 0
let n = 0
for (const po of todo) {
  n++
  try {
    await approve('PU_ORDER', po)                                    // ① 采购订单补审核(幂等)
    const ln = await post('/api/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po })
    const lines = ((ln.data && ln.data.lines) || []).filter((x) => Number(x['剩余数量']) > 0)
      .map((x) => ({ lineKey: x._lineKey || x.lineKey, qty: x['剩余数量'] }))
    if (!lines.length) { skip++; rows.push({ po, sl: '', gen: '(无可送行)' }); continue }
    const g = await post('/api/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po, lines })
    const sl = g.data && g.data['编号']
    if (!sl) { bad++; rows.push({ po, sl: '', gen: '生暂收单失败:' + (g.message || '').slice(0, 40) }); continue }
    okSl++
    await approve('QC_RECV', sl)                                     // ② 暂收单审核
    const gg = await btn('QC_RECV', '生成检验或入库单', { 编号: sl, 单据编号: sl })
    const list = (gg.data && gg.data['生成清单']) || []
    if (list.length) okGen++
    rows.push({ po, sl, gen: list.map((x) => x['面板'] + ':' + x['编号']).join(' + ') || ('生单失败:' + (gg.message || '').slice(0, 40)) })
  } catch (e) { bad++; rows.push({ po, sl: '', gen: '异常:' + String(e.message).slice(0, 50) }) }
  if (n % 20 === 0) console.log(`  ... ${n}/${todo.length}(暂收单 ${okSl} / 生单成功 ${okGen} / 跳过 ${skip} / 失败 ${bad})`)
}

const md = [`# 采购订单 → 送料暂收单 → 生单分流(${DB},${FROM} 起)`, '',
  `- 时间:${new Date().toISOString()}  采购订单 ${todo.length} 张`,
  `- 生成送料暂收单 **${okSl}** 张;完成生单分流 **${okGen}** 张;无可送行跳过 ${skip} 张;失败 ${bad} 张`, '',
  '| 采购订单 | 送料暂收单 | 生单结果 |', '|---|---|---|',
  ...rows.map((r) => `| ${r.po} | ${r.sl} | ${r.gen} |`)].join('\n')
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL(`./_dump-out/po-flow-${TAG}-1014.md`, import.meta.url), md, 'utf8')
console.log(`\n暂收单 ${okSl} / 生单成功 ${okGen} / 跳过 ${skip} / 失败 ${bad}`)
console.log(`[产物] tools/archive/_dump-out/po-flow-${TAG}-1014.md`)
