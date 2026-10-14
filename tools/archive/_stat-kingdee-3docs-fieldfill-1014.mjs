/**
 * 只读探针(2026-10-14)Phase 0/3:金蝶三类单据(产品入库/其他入库/其他出库)的**字段取值统计**。
 *
 * 为什么需要:「字段完全对照金蝶来写」+ 用户口径「主要的字段不能少,**有数据的字段**要保留(不是无用数据)」。
 *   ⇒ 只拿一张样例看不出某个键是不是恒空。本探针按**大样本**逐键统计「非空率」,给字段取舍提供证据:
 *     非空率高 ⇒ 必须登记;恒空 ⇒ 要么是链路需要(如 src_* 挂源单)登记成隐藏,要么直接不登记。
 *
 * 做法:每类取 N 张已审核单据(默认 30),逐张拉详情,累计 表头键 / 分录键 的「出现次数、非空次数、样例值」。
 *   分录类键按「该单任一分录有值」计。
 *
 * 只读(全部 GET),不写任何单据。用法:
 *   node tools/archive/_stat-kingdee-3docs-fieldfill-1014.mjs [每类张数]
 * 产物: tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.json / .md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const N = Number(process.argv[2] || 30)
const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 空值判定:'', null, 0 视为空(0 在金额/数量类里等同于"没数据");false 也视为空 */
const isEmpty = (v) => v === '' || v === null || v === undefined || v === 0 || v === '0' || v === false || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

const DOCS = [
  ['inv_product', '产品入库单', 'FINISH_IN', '产成品入库单'],
  ['inv_other_in', '其他入库单', 'OTHER_IN', '其他入库单'],
  ['inv_other_out', '其他出库单', 'OTHER_OUT', '其他出库单'],
]

const result = { at: new Date().toISOString(), account: cfg.outerInstanceId, sampleSize: N, docs: {} }
const md = ['# 金蝶三类单据:字段非空率统计(只读)', '', `- 账套:惠州市银嘉环保(clientId ${cfg.clientId})`, `- 每类取样:**${N}** 张已审核单据的详情`, `- 口径:非空 = 值不是 ''/null/0/false/空对象;分录键按「任一分录非空」计`, '']

for (const [api, kdName, panel, mesName] of DOCS) {
  const listPath = `/jdy/v2/scm/${api}`
  const detailPath = `${listPath}_detail`
  const ids = []
  for (let page = 1; ids.length < N && page <= Math.ceil(N / 50); page++) {
    const r = await kingdeeTryGet(cfg, token, listPath, { bill_status: 'C', page: String(page), page_size: '50' })
    if (!r.ok) break
    for (const row of r.data.rows || []) { if (ids.length < N) ids.push({ id: String(row.id), bill_no: row.bill_no }) }
    await sleep(200)
  }
  const stat = { header: {}, entry: {}, total: ids.length, bills: ids.map((x) => x.bill_no) }
  const bump = (bucket, k, v) => {
    const cur = bucket[k] || (bucket[k] = { present: 0, nonEmpty: 0, sample: '' })
    cur.present++
    if (!isEmpty(v)) { cur.nonEmpty++; if (!cur.sample) cur.sample = String(JSON.stringify(v)).slice(0, 80) }
  }
  for (const { id } of ids) {
    const d = await kingdeeTryGet(cfg, token, detailPath, { id })
    const dd = d.ok ? d.data || {} : {}
    for (const k of Object.keys(dd)) if (k !== 'material_entity') bump(stat.header, k, dd[k])
    const ents = dd.material_entity || []
    for (const e of ents) for (const k of Object.keys(e)) bump(stat.entry, k, e[k])
    await sleep(140)
  }
  result.docs[api] = stat
  const rows = (bucket, label) => {
    const arr = Object.entries(bucket).sort((a, b) => b[1].nonEmpty - a[1].nonEmpty || a[0].localeCompare(b[0]))
    md.push(`## ${kdName} \`${api}\`(MES 面板 \`${panel}\` ${mesName})—— 取样 ${stat.total} 张`, '')
    md.push(`### ${label}(${arr.length} 键,按非空数降序)`, '')
    md.push('| 键 | 非空 / 出现 | 非空率 | 样例值 |')
    md.push('|---|---|---|---|')
    for (const [k, s] of arr) md.push(`| \`${k}\` | ${s.nonEmpty} / ${s.present} | ${(s.nonEmpty / Math.max(1, s.present) * 100).toFixed(0)}% | ${String(s.sample).replace(/\|/g, '\\|')} |`)
    md.push('')
    return arr
  }
  const h = rows(stat.header, '表头键')
  const e = rows(stat.entry, '分录键')
  console.log(`${kdName.padEnd(6)} ${api.padEnd(15)} 取样 ${stat.total} 张;表头键 ${h.length}(恒空 ${h.filter(([, s]) => s.nonEmpty === 0).length}) / 分录键 ${e.length}(恒空 ${e.filter(([, s]) => s.nonEmpty === 0).length})`)
}

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-3docs-fieldfill-1014.json', import.meta.url), JSON.stringify(result, null, 1), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-3docs-fieldfill-1014.md', import.meta.url), md.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.{json,md}')
