/**
 * 同步单据补审核 + 整月销售订单结转生产工单(2026-10-14,正式库,只走 API)
 *
 * 背景(用户 2026-10-14):
 *   ① 「生产加工单是要和整月的销售订单保持一致的,真的只有11个单吗」——
 *      金蝶同步进来的销售订单只在**物理列**写了「已审核」,**没有工作流审核留痕**,
 *      而订单结转页按**工作流派生状态**筛「已审核」⇒ 全被当草稿排除 ⇒ 只转出 11 张工单。
 *   ② 「同步下来的出入库单还有销售订单采购订单要确保状态」「大部分状态都是草稿」—— 同一根因。
 *   ⇒ 本脚本:先给整月同步的销售订单/采购订单补「提交审批 → 审批通过」,再看结转页待转行,再转工单。
 *
 * 用法: node tools/archive/_audit-synced-and-convert-1014.mjs [--from 2026-09-01] [--dry] [--limit N]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const LIMIT = Number(arg('limit', '0')) || 0
const DRY = argv.includes('--dry')
const BASE = 'http://127.0.0.1:8090'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
// 同步下来、整月、且**还没有审核留痕**的订单
const sos = await q(`SELECT o.单据编号 AS no FROM bd_so_order o
  WHERE o.asp_user1 = N'金蝶拉取' AND o.单据日期 >= '${FROM}'
    AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='SO_ORDER' AND s.doc_no=o.单据编号)`)
const pos = await q(`SELECT o.单据编号 AS no FROM bd_pu_order o
  WHERE o.asp_user1 = N'金蝶拉取' AND o.单据日期 >= '${FROM}'
    AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号)`)
await pool.close()
console.log(`待补审核:销售订单 ${sos.length} 张 / 采购订单 ${pos.length} 张`)
if (DRY) process.exit(0)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())
const btn = async (p, name, no) => post('/api/px/callButton', {
  panelCode: p, buttonName: name, formData: { 编号: no, 单据编号: no }, buttonParam: {},
})
/** 幂等补审核:先提交审批(草稿才需要),再审批通过;已审核的会报"仅审批中状态"⇒ 视为已达成 */
const ensureAudited = async (panel, no) => {
  await btn(panel, '提交审批', no)
  const a = await btn(panel, '审批通过', no)
  return a.code === 200 || a.code === 0
}

let okSo = 0, okPo = 0, n = 0
for (const s of sos) { if (await ensureAudited('SO_ORDER', s.no)) okSo++; if (++n % 25 === 0) console.log(`  ...SO ${n}/${sos.length}`) }
n = 0
for (const p of pos) { if (await ensureAudited('PU_ORDER', p.no)) okPo++; if (++n % 25 === 0) console.log(`  ...PO ${n}/${pos.length}`) }
console.log(`补审核完成:销售订单 ${okSo}/${sos.length};采购订单 ${okPo}/${pos.length}`)

// 再看结转页待转行(补审核后应显著变多)
const pending = await post('/api/px/orderConvert/pending', { dateFrom: FROM })
const list = (pending.data && (pending.data.list || pending.data.rows)) || pending.data || []
console.log(`结转页待转行 = ${list.length}(补审核前只有 28 行)`)
const routes = (await post('/api/px/processTask/routes', {})).data || []
const route = (routes.find((r) => r['编码'] === 'GY-CB-STD') || routes[0] || {})['编码']
const rows = (LIMIT ? list.slice(0, LIMIT) : list).map((x) => { if (!x['工艺路线']) x['工艺路线'] = route; return x })
let gen = { '生成张数': 0, '编号清单': [] }
if (rows.length) {
  const r = await post('/api/px/orderConvert/toManu', { rows })
  gen = r.data || gen
  console.log(`转工单: code=${r.code} 生成张数=${gen['生成张数']} 失败行=${(gen['失败行'] || []).length}`)
}
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/audit-synced-convert-1014.md', import.meta.url),
  [`# 同步单据补审核 + 整月销售订单结转工单`, '', `- 时间:${new Date().toISOString()}`,
    `- 待补审核:销售订单 ${sos.length}(成功 ${okSo})/ 采购订单 ${pos.length}(成功 ${okPo})`,
    `- 结转页待转行:${list.length};本次转工单 ${gen['生成张数']} 张(失败行 ${(gen['失败行'] || []).length})`,
    '', '生成单号:', ...(gen['编号清单'] || []).map((x) => '- ' + x)].join('\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/audit-synced-convert-1014.md')
