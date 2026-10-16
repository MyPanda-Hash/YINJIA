/**
 * 同步单据「按真实状态补审核」(2026-10-14,正式库 HSDZ_MES,**不碰测试库**)
 *
 * 用户口径:①生产工单要和整月销售订单一致(远不止 11 张);②同步下来的出入库/销售订单/采购订单
 *   都要确保状态(界面上大部分显示"草稿");③每个单据都要验证状态与日期。
 *
 * 🔴 状态真源 = `yj_doc_status`(工作流派生),**不是**物理列「单据状态」:
 *     shr 非空 = 已审核;pending='Y' = 审批中;两者都没有 = 草稿。
 *   同步只写了物理列 ⇒ 界面按草稿显示,结转页也把销售订单排除在外(所以上一轮只转出 11 张工单)。
 *   ⚠ 早先我用「有没有 yj_doc_status 行」判断是错的:同步单据**有**留痕行,只是 shr 为空。
 *
 * 用法: node tools/archive/_ensure-audited-all-1014.mjs [--from 2026-09-01] [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const DRY = argv.includes('--dry')
const BASE = arg('base', 'http://127.0.0.1:8090')   // 历史回填时指向带 -Dmes.hist.backfill=true 的实例(如 8091)
// 落库人标记:拉取脚本原写「金蝶拉取」,2026-10-16 起改名「试运行」(提交 2297296d)⇒ 参数化,默认按新名
const MARKER = arg('marker', '试运行')

// 面板 → 头表(只处理金蝶同步进来的、日期在区间内的)
const PANELS = [
  ['SO_ORDER', 'bd_so_order', '销售订单'],
  ['PU_ORDER', 'bd_pu_order', '采购订单'],
  ['PURCHASE_IN', 'bd_purchase_in', '采购入库单'],
  ['SALE_OUT', 'bd_sale_out', '销售出库单'],
  ['MATERIAL_OUT', 'bd_material_out', '生产领料单'],
  ['FINISH_IN', 'bd_finish_in', '产品入库单'],
  ['OTHER_IN', 'bd_other_in', '其他入库单'],
  ['OTHER_OUT', 'bd_other_out', '其他出库单'],
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
const work = []
for (const [panel, table, name] of PANELS) {
  const rows = await q(`SELECT o.单据编号 AS no,
      CASE WHEN ISNULL(s.shr,'') <> '' THEN N'已审核'
           WHEN ISNULL(s.pending,'N') = 'Y' THEN N'审批中'
           ELSE N'草稿' END AS st
    FROM ${table} o
    LEFT JOIN yj_doc_status s ON s.panel_code = '${panel}' AND s.doc_no = o.单据编号
    WHERE o.asp_user1 = N'${MARKER}' AND o.单据日期 >= '${FROM}'`)
  const draft = rows.filter((r) => r.st === '草稿')
  const pending = rows.filter((r) => r.st === '审批中')
  work.push({ panel, name, total: rows.length, draft, pending })
  console.log(`${name.padEnd(6)} 同步 ${String(rows.length).padStart(4)} | 已审核 ${String(rows.length - draft.length - pending.length).padStart(4)} | 审批中 ${pending.length} | 草稿 ${draft.length}`)
}
await pool.close()
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

const report = []
for (const w of work) {
  let ok = 0, bad = 0
  for (const d of [...w.pending, ...w.draft]) {
    await btn(w.panel, '提交审批', d.no)
    const a = await btn(w.panel, '审批通过', d.no)
    if (a.code === 200 || a.code === 0) ok++; else { bad++; if (bad <= 3) report.push(`${w.name} ${d.no}: ${(a.message || '').slice(0, 60)}`) }
  }
  console.log(`补审核 ${w.name}: 成功 ${ok} / 失败 ${bad}(待处理 ${w.pending.length + w.draft.length})`)
}
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/ensure-audited-1014.md', import.meta.url),
  [`# 同步单据补审核(按工作流真实状态)`, '', `- 时间:${new Date().toISOString()}  区间 ${FROM} 起  库:HSDZ_MES(正式)`,
    '', ...work.map((w) => `- ${w.name}:同步 ${w.total},待补审核 ${w.pending.length + w.draft.length}`),
    '', '## 失败样例', '', ...(report.length ? report.map((x) => '- ' + x) : ['(无)'])].join('\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/ensure-audited-1014.md')
