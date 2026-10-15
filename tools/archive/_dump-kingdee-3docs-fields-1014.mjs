/**
 * 只读探针(2026-10-14)Phase 0:金蝶银嘉账套三类单据的**完整字段清单**(表头 + 分录 + 样例行值)。
 *
 * 用途:用户要求「字段完全对照金蝶接口来写」+ 产出一份《出入库单据字段与显示字段》基线文档。
 *   ⇒ 先把金蝶侧的真源字段**逐键落盘**,后续 MES 的列/标签/映射与文档全部以本产物为准(不靠记忆/不靠猜)。
 *
 * 覆盖三类(与用户任务一一对应):
 *   · /jdy/v2/scm/inv_product   产品入库单  ← 对应 MES 产成品入库单 FINISH_IN(后面要补一个检验字段)
 *   · /jdy/v2/scm/inv_other_in  其他入库单  ← 对应 MES 其他入库单 OTHER_IN
 *   · /jdy/v2/scm/inv_other_out 其他出库单  ← 对应 MES 其他出库单 OTHER_OUT
 * 对照参照(用户口径:显示字段对照采购入库单/销售出库单):
 *   · /jdy/v2/scm/pur_inbound   采购入库单  ← MES PURCHASE_IN(已跑通)
 *   · /jdy/v2/scm/sal_out_bound 销售出库单  ← MES SALE_OUT(已跑通)
 *
 * 只读(全部 GET),不写任何单据、不改任何配置。
 * 用法:  node tools/archive/_dump-kingdee-3docs-fields-1014.mjs
 * 产物:  tools/archive/_dump-out/kingdee-3docs-fields-1014.json(结构化,供生成器直接读)
 *        tools/archive/_dump-out/kingdee-3docs-fields-1014.md  (人读,含样例行值)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)

const DOCS = [
  ['inv_product', '产品入库单', 'FINISH_IN', '产成品入库单', 'target'],
  ['inv_other_in', '其他入库单', 'OTHER_IN', '其他入库单', 'target'],
  ['inv_other_out', '其他出库单', 'OTHER_OUT', '其他出库单', 'target'],
  ['pur_inbound', '采购入库单', 'PURCHASE_IN', '采购入库单', 'ref'],
  ['sal_out_bound', '销售出库单', 'SALE_OUT', '销售出库单', 'ref'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const result = { account: { name: '惠州市银嘉环保科技有限公司', outerInstanceId: cfg.outerInstanceId, clientId: cfg.clientId }, at: new Date().toISOString(), docs: {} }
const md = []
md.push('# 金蝶星辰:出入库单据接口字段清单(只读 dump)')
md.push('')
md.push(`- 账套:惠州市银嘉环保科技有限公司(outerInstanceId ${cfg.outerInstanceId},clientId ${cfg.clientId})`)
md.push(`- 抓取时间:${result.at}`)
md.push('- 说明:表头键 = 详情接口顶层键;分录键 = `material_entity` 首条分录的键;样例值取自账套内**最新一张已审核单据**。')
md.push('')

for (const [api, kdName, panel, mesName, role] of DOCS) {
  const listPath = `/jdy/v2/scm/${api}`
  const detailPath = `${listPath}_detail`
  const list = await kingdeeTryGet(cfg, token, listPath, { bill_status: 'C', page: '1', page_size: '1' })
  if (!list.ok) {
    md.push(`## ${kdName} \`${listPath}\` — ❌ ${String(list.error).slice(0, 120)}`)
    result.docs[api] = { error: String(list.error) }
    await sleep(220)
    continue
  }
  const row = (list.data.rows || [])[0] || {}
  const det = await kingdeeTryGet(cfg, token, detailPath, { id: String(row.id) })
  const d = det.ok ? det.data || {} : {}
  const ents = d.material_entity || []
  const sample = ents[0] || {}
  result.docs[api] = {
    kdName, panel, mesName, role,
    listPath, detailPath,
    count: list.data.count,
    sampleBillNo: d.bill_no || row.bill_no,
    sampleBillDate: d.bill_date || row.bill_date,
    headerKeys: Object.keys(d),
    entryKeys: Object.keys(sample),
    header: d,
    entry: sample,
    entryCount: ents.length,
  }
  md.push(`## ${kdName} — 金蝶接口 \`${listPath}\`(MES 面板 \`${panel}\` ${mesName})`)
  md.push('')
  md.push(`- 账套内条数(已审核):**${list.data.count}**;本清单取样单号:\`${d.bill_no || row.bill_no}\`(${d.bill_date || row.bill_date}),分录 ${ents.length} 行`)
  md.push(`- 表头键 **${Object.keys(d).length}** 个 / 分录键 **${Object.keys(sample).length}** 个`)
  md.push('')
  md.push('### 表头(键 = 值)')
  md.push('')
  md.push('| 键 | 样例值 |')
  md.push('|---|---|')
  for (const k of Object.keys(d)) {
    const v = d[k]
    if (k === 'material_entity') { md.push(`| ${k} | (分录 ${ents.length} 行,见下) |`); continue }
    md.push(`| ${k} | ${String(JSON.stringify(v) ?? '').replace(/\|/g, '\\|').slice(0, 150)} |`)
  }
  md.push('')
  md.push('### 分录(首条)')
  md.push('')
  md.push('| 键 | 样例值 |')
  md.push('|---|---|')
  for (const k of Object.keys(sample)) {
    md.push(`| ${k} | ${String(JSON.stringify(sample[k]) ?? '').replace(/\|/g, '\\|').slice(0, 150)} |`)
  }
  md.push('')
  await sleep(250)
}

const dir = new URL('./_dump-out/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-3docs-fields-1014.json', import.meta.url), JSON.stringify(result, null, 1), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-3docs-fields-1014.md', import.meta.url), md.join('\n'), 'utf8')
console.log('三类单据字段清单已落盘:')
for (const [api, kdName] of DOCS.map((d) => [d[0], d[1]])) {
  const r = result.docs[api]
  console.log(`  ${kdName.padEnd(6)} ${api.padEnd(15)} count=${r?.count ?? 'ERR'} 表头键=${r?.headerKeys?.length ?? '-'} 分录键=${r?.entryKeys?.length ?? '-'} 取样=${r?.sampleBillNo ?? '-'}`)
}
console.log('\n[产物] tools/archive/_dump-out/kingdee-3docs-fields-1014.json / .md')
