/**
 * 字段取值统计(2026-10-14):采购入库单 / 销售出库单 / 生产领料单 的逐键非空率。
 *
 * 为什么需要:拉取脚本要「按金蝶字段映射」把这三类单据拉进 MES(它们此前只有**推送**方向,
 *   没有拉取映射)。字段取舍沿用同一口径:**只映射有数据的键 + 链路必需键**(用户口径「不要无用数据」),
 *   判定依据就是本探针的 30 张真实单据逐键统计。
 *
 * 只读(全部 GET)。用法: node tools/archive/_stat-kingdee-3docs-fieldfill2-1014.mjs [每类张数]
 * 产物: tools/archive/_dump-out/kingdee-3docs2-fieldfill-1014.{json,md}
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const N = Number(process.argv[2] || 30)
const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isEmpty = (v) => v === '' || v === null || v === undefined || v === 0 || v === '0' || v === false || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

const DOCS = [
  ['pur_inbound', '采购入库单', 'PURCHASE_IN'],
  ['sal_out_bound', '销售出库单', 'SALE_OUT'],
  ['inv_pick', '生产领料单(材料出库)', 'MATERIAL_OUT'],
  ['pur_order', '采购订单', 'PU_ORDER'],
  ['sal_order', '销售订单', 'SO_ORDER'],
]

const result = { at: new Date().toISOString(), sampleSize: N, docs: {} }
const md = ['# 金蝶单据字段非空率(第二批:其余 5 类)', '', `- 账套:惠州市银嘉环保(clientId ${cfg.clientId})`, `- 每类取样 **${N}** 张已审核单据详情`, '']

for (const [api, kdName, panel] of DOCS) {
  const listPath = `/jdy/v2/scm/${api}`
  const detailPath = `${listPath}_detail`
  const ids = []
  for (let page = 1; ids.length < N && page <= Math.ceil(N / 50); page++) {
    const r = await kingdeeTryGet(cfg, token, listPath, { bill_status: 'C', page: String(page), page_size: '50' })
    if (!r.ok) break
    for (const row of r.data.rows || []) if (ids.length < N) ids.push({ id: String(row.id), bill_no: row.bill_no })
    await sleep(200)
  }
  const stat = { header: {}, entry: {}, total: ids.length, bills: ids.map((x) => x.bill_no) }
  const bump = (b, k, v) => { const c = b[k] || (b[k] = { present: 0, nonEmpty: 0, sample: '' }); c.present++; if (!isEmpty(v)) { c.nonEmpty++; if (!c.sample) c.sample = String(JSON.stringify(v)).slice(0, 70) } }
  for (const { id } of ids) {
    const d = await kingdeeTryGet(cfg, token, detailPath, { id })
    const dd = d.ok ? d.data || {} : {}
    for (const k of Object.keys(dd)) if (k !== 'material_entity') bump(stat.header, k, dd[k])
    for (const e of dd.material_entity || []) for (const k of Object.keys(e)) bump(stat.entry, k, e[k])
    await sleep(140)
  }
  result.docs[api] = stat
  const rows = (b, label) => {
    const arr = Object.entries(b).sort((a, c) => c[1].nonEmpty - a[1].nonEmpty || a[0].localeCompare(c[0]))
    md.push(`## ${kdName} \`${api}\`(MES 面板 \`${panel}\`)—— 取样 ${stat.total} 张`, '', `### ${label}`, '', '| 键 | 非空/出现 | 非空率 | 样例 |', '|---|---|---|---|')
    for (const [k, s] of arr) md.push(`| \`${k}\` | ${s.nonEmpty}/${s.present} | ${(s.nonEmpty / Math.max(1, s.present) * 100).toFixed(0)}% | ${String(s.sample).replace(/\|/g, '\\|')} |`)
    md.push('')
    return arr
  }
  const h = rows(stat.header, '表头键')
  const e = rows(stat.entry, '分录键')
  console.log(`${kdName.padEnd(12)} ${api.padEnd(15)} 取样 ${stat.total};表头 ${h.length}(恒空 ${h.filter(([, s]) => s.nonEmpty === 0).length}) / 分录 ${e.length}(恒空 ${e.filter(([, s]) => s.nonEmpty === 0).length})`)
}

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-3docs2-fieldfill-1014.json', import.meta.url), JSON.stringify(result, null, 1), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-3docs2-fieldfill-1014.md', import.meta.url), md.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-3docs2-fieldfill-1014.{json,md}')
