/**
 * 只读探针(2026-10-15,第四版):拿 MES inh/outh 里已有的**金蝶单号**,回金蝶逐单核对
 * 「这些半成品出入库在金蝶侧确实存在」,并看单号过滤参数是否可用。
 *
 * 背景:MES inh/outh 是金蝶出入库流水的对齐结果;其中属半成品分类的行:
 *   入库(inh)7 行 / 出库(outh)11 行,单号形如 CPRK / XSCK / SCLL / QTCK / CGRK 系列。
 * 本探针把这些单号在金蝶侧拉详情,打印含半成品的分录 → 结论的证据闭环。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-semi-bills-1015.mjs
 * 产物: tools/archive/_probe-kingdee-semi-bills-1015.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token } = await fetchAppToken(cfg)

const BILLS = [
  ['产成品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20261006-00001'],
  ['产成品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260926-00002'],
  ['产成品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260920-00003'],
  ['产成品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260907-00003'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20261010-00007'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260924-00009'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260912-00003'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260907-00001'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260904-00022'],
  ['材料出库单', '/jdy/v2/scm/inv_pick', 'SCLL-20261010-00017'],
  ['材料出库单', '/jdy/v2/scm/inv_pick', 'SCLL-20260929-00004'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', 'QTCK-20260918-01132'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', 'QTCK-20260902-01095'],
  ['采购入库单', '/jdy/v2/scm/pur_inbound', 'CGRK-20261010-03380'],
  ['采购入库单', '/jdy/v2/scm/pur_inbound', 'CGRK-20260927-03295'],
]

// 半成品集合(判据 parent_name='半成品')
const mats = []
for (let p = 1; p <= 40; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const m of rows) mats.push(m)
  if (rows.length < 200) break
  await sleep(130)
}
const semiSet = new Set(mats.filter((m) => String(m.parent_name || '').trim() === '半成品').map((m) => String(m.number || '').trim()))
say(`半成品编码集合 ${semiSet.size} 个`)
say(`\n=== 逐单回金蝶核对(MES inh/outh 里出现的半成品单号)===\n`)

const pickEntries = (d) => {
  for (const k of ['material_entity', 'bill_entry', 'entries', 'entry']) if (Array.isArray(d?.[k]) && d[k].length) return d[k]
  return []
}
let confirmed = 0
for (const [label, path, no] of BILLS) {
  // 列表接口能否按 bill_no 过滤
  const l = await kingdeeTryGet(cfg, token, path, { bill_no: no, page: '1', page_size: '5' })
  let bill = null
  if (l.ok && (l.data?.rows || []).length) bill = l.data.rows.find((r) => String(r.bill_no) === no) || l.data.rows[0]
  if (!bill) {
    // 退化:分页找(限制页数)
    say(`   ⚠ ${label} ${no}: bill_no 过滤未命中(${l.ok ? 'count=' + l.data?.count : String(l.error).slice(0, 60)})`)
    await sleep(160)
    continue
  }
  const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(bill.id) })
  const ents = d.ok ? pickEntries(d.data) : []
  const semiLines = ents.filter((e) => semiSet.has(String(e.material_number || '').trim()))
  const mark = semiLines.length ? '✅' : '—'
  say(`${mark} ${label} ${no} (${bill.bill_date}) 分录 ${ents.length} 行;半成品 ${semiLines.length} 行`)
  for (const e of semiLines) { confirmed++; say(`      · ${e.material_number} ${e.material_name} 数量=${e.qty ?? e.actual_qty ?? ''} 仓=${e.stock_number || ''}/${e.stock_name || ''} 批号=${e.batch_no || '-'}`) }
  await sleep(180)
}
say(`\n=== 小结:回金蝶确认到的半成品分录 ${confirmed} 行(来自上述 ${BILLS.length} 张单)==`)

writeFileSync(new URL('./_probe-kingdee-semi-bills-1015.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物] tools/archive/_probe-kingdee-semi-bills-1015.out.txt')
