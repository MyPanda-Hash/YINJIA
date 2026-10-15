/**
 * 只读探针(2026-10-15,第二版):金蝶真实账套「半成品」的**出入库数据**到底有没有。
 *
 * 第一版(_probe-kingdee-semi-1015.mjs)判据取错:商品分类挂在 `/jdy/v2/bd/material` 的
 * **parent_name**(不是 group_name,后者恒空)⇒ 候选集合为空,单据扫描的 0 命中不算证据。
 * 本版修正为:半成品集合 = parent_name == '半成品' 的 752 个商品编码。
 *
 * 抽样口径:每类单据按**整段历史均匀抽 40 张**(按 count 算页号,页内取 2 张),
 *          逐张拉 `_detail`,统计分录里 material_number ∈ 半成品集合 的行,并列样本。
 * 另:候选探测「库存流水/收发存」类报表接口(有则能一次拿全流水)。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-semi-1015b.mjs [--per 40]
 * 产物: tools/archive/_probe-kingdee-semi-1015b.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const PER = Number(process.argv[process.argv.indexOf('--per') + 1]) || 40
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token } = await fetchAppToken(cfg)

say('=== 金蝶真实账套:「半成品」的出入库数据(只读 · 第二版判据)===')
say(`账套 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}   时间 ${new Date().toISOString()}`)
say(`抽样口径:每类单据沿整段历史均匀抽 ${PER} 张`)

// ── ① 半成品商品集合(parent_name = 半成品) ──
const mats = []
for (let p = 1; p <= 40; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const m of rows) mats.push(m)
  if (rows.length < 200) break
  await sleep(140)
}
const semi = mats.filter((m) => String(m.parent_name || '').trim() === '半成品')
const semiSet = new Set(semi.map((m) => String(m.number || '').trim()))
const nameOf = new Map(semi.map((m) => [String(m.number || '').trim(), m.name]))
say(`\n① 商品档案 ${mats.length} 条;分类=半成品(paren_name)的 ${semi.length} 条 ⇒ 半成品编码集合 ${semiSet.size} 个`)
say(`   半成品样例(前 15): ${semi.slice(0, 15).map((m) => `${m.number}(${m.name})`).join('、')}`)

// ── ② 候选:库存流水/收发存 类报表接口 ──
say('\n② 候选:库存流水/收发存 类接口探测')
for (const p of ['/jdy/v2/inv/inv_stock_flow', '/jdy/v2/inv/inv_inout', '/jdy/v2/scm/inv_stock_flow', '/jdy/v2/inv/inv_ledger', '/jdy/v2/inv/inv_inventory_flow', '/jdy/v2/report/inv_stock_flow']) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '2' })
  say(`   ${r.ok ? '✅' : '❌'} ${p.padEnd(36)} ${r.ok ? 'count=' + r.data?.count : String(r.error).slice(0, 70)}`)
  await sleep(150)
}

// ── ③ 逐类单据:历史均匀抽样 ──
const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['采购退货单', '/jdy/v2/scm/pur_ret'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound'],
  ['生产领料单(材料出库)', '/jdy/v2/scm/inv_pick'],
  ['产品入库单', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill'],
  ['组装单', '/jdy/v2/scm/inv_assemble'],
]
const PAGE = 100
const pickEntries = (d) => {
  for (const k of ['material_entity', 'bill_entry', 'entries', 'entry']) if (Array.isArray(d?.[k]) && d[k].length) return d[k]
  for (const k of Object.keys(d || {})) {
    const v = d[k]
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && Object.keys(v[0]).some((x) => /material/i.test(x))) return v
  }
  return []
}

say('\n③ 逐类单据:整段历史均匀抽样 → 分录命中半成品的情况')
const summary = []
for (const [label, path] of DOCS) {
  const head = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1' })
  if (!head.ok) { say(`\n--- ${label} ${path}\n    ❌ ${String(head.error).slice(0, 110)}`); summary.push({ label, ok: false }); await sleep(180); continue }
  const total = Number(head.data?.count || 0)
  if (!total) { say(`\n--- ${label} ${path}\n    总数 0 ⇒ 金蝶该单据类型没有任何已审核单据`); summary.push({ label, ok: true, total: 0 }); await sleep(180); continue }
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const need = Math.min(pages, Math.ceil(PER / 2))
  const pageList = [...new Set(Array.from({ length: need }, (_, i) => (need === 1 ? 1 : Math.round(1 + (i * (pages - 1)) / (need - 1)))))]
  let bills = []
  for (const pg of pageList) {
    const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: String(pg), page_size: String(PAGE) })
    if (!r.ok) continue
    const rows = r.data?.rows || []
    // 每页取首尾两张(页内也分散)
    if (rows[0]) bills.push(rows[0])
    if (rows[rows.length - 1] && rows.length > 1) bills.push(rows[rows.length - 1])
    await sleep(130)
  }
  bills = bills.slice(0, PER)
  let lines = 0, hitLines = 0, hitBills = 0
  const samples = []
  const dates = []
  for (const b of bills) {
    const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(b.id) })
    if (!d.ok) { await sleep(120); continue }
    const ents = pickEntries(d.data)
    lines += ents.length
    let n = 0
    for (const e of ents) {
      const num = String(e.material_number || '').trim()
      if (semiSet.has(num)) {
        hitLines++; n++
        dates.push(String(b.bill_date || ''))
        if (samples.length < 15) samples.push(`${b.bill_no}(${b.bill_date}) ${num} ${e.material_name || nameOf.get(num) || ''} 数量=${e.qty ?? e.actual_qty ?? e.base_qty ?? ''} 仓=${e.stock_number || ''}/${e.stock_name || ''} 批号=${e.batch_no || '-'}`)
      }
    }
    if (n) hitBills++
    await sleep(120)
  }
  say(`\n--- ${label}  ${path}`)
  say(`    已审核总数 = ${total};抽取 ${bills.length} 张(${pageList.length} 页均匀分布);取到明细 ${lines} 行`)
  say(`    **命中半成品的分录 = ${hitLines} 行 / 涉及单据 = ${hitBills} 张**`)
  if (samples.length) { say('    命中样本:'); for (const s of samples) say(`      · ${s}`) }
  summary.push({ label, ok: true, total, sampled: bills.length, lines, hitLines, hitBills, dates })
  await sleep(180)
}

// ── ④ 现存量:半成品分类的库存(旁证) ──
say('\n④ 现存量(IMS)里分类=半成品的行')
let invSemi = 0, invTotal = 0, invQty = 0
for (let p = 1; p <= 20; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const x of rows) {
    invTotal++
    if (String(x.material_category_name || '') === '半成品') { invSemi++; invQty += Number(x.qty || 0); say(`   · ${x.material_number} ${x.material_name} | ${x.stock_number}/${x.stockid_name} | qty=${x.qty} 可用=${x.valid_qty}`) }
  }
  if (rows.length < 200) break
  await sleep(140)
}
say(`   合计:库存行 ${invTotal},其中半成品 ${invSemi} 行,数量合计 ${invQty}`)

say('\n⑤ 小结')
for (const s of summary) say(`   · ${s.label}: ${!s.ok ? '接口不可用' : s.total === 0 ? '金蝶无此类单据' : `总数 ${s.total},抽 ${s.sampled} 张/${s.lines} 行 → 半成品分录 ${s.hitLines} 行(${s.hitBills} 张)${s.hitLines ? ' 日期 ' + s.dates[0] + '~' + s.dates[s.dates.length - 1] : ''}`}`)
say(`   · 半成品商品 ${semi.length} 个;现存量里半成品 ${invSemi} 行 / 数量 ${invQty}`)

writeFileSync(new URL('./_probe-kingdee-semi-1015b.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-semi-1015b.out.txt')
