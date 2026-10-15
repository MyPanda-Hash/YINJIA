/**
 * 只读探针(2026-10-15,第三版):把「金蝶有没有半成品出入库数据」的取证做扎实。
 *
 * 第二版(_probe-kingdee-semi-1015b.mjs)已确定:半成品 = 商品分类 parent_name='半成品'(752 个编码);
 * 均匀抽样(每类 40 张)只命中 2 行。本版加深:
 *   ① 总量小的单据类型(采购退货/销售退货/其他入库/盘点/调拨)**全量逐张**扫分录;
 *   ② 大类型(采购入库/销售出库/生产领料/产品入库/其他出库)沿历史抽 --per 张(默认 150);
 *   ③ 汇总:各类型分录命中半成品的行数、涉及单据、日期跨度、涉及商品 TOP;
 *   ④ 对「有库存的 5 个半成品」单独列其命中记录(它们才是有实物流的半成品)。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-semi-1015c.mjs [--per 150]
 * 产物: tools/archive/_probe-kingdee-semi-1015c.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const PER = Number(process.argv[process.argv.indexOf('--per') + 1]) || 150
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token } = await fetchAppToken(cfg)

say('=== 金蝶真实账套:半成品出入库取证(只读 · 第三版,加深抽样)===')
say(`账套 clientId=${cfg.clientId}   时间 ${new Date().toISOString()}`)
say(`口径:半成品 = /jdy/v2/bd/material 的 parent_name='半成品';小类型全量扫,大类型抽 ${PER} 张`)

// ① 半成品编码集合
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
const nameOf = new Map(semi.map((m) => [String(m.number || '').trim(), String(m.name || '')]))
say(`\n① 商品 ${mats.length} 条 → 半成品 ${semi.length} 个编码`)

// ② 有库存的半成品(实物流只有这几个,重点看它们)
const stocked = new Map()
for (let p = 1; p <= 20; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const x of rows) if (String(x.material_category_name || '') === '半成品') stocked.set(String(x.material_number), { name: x.material_name, stock: `${x.stock_number}/${x.stockid_name}`, qty: x.qty })
  if (rows.length < 200) break
  await sleep(140)
}
say(`② 现存量里有余额的半成品 ${stocked.size} 个: ${[...stocked.entries()].map(([k, v]) => `${k}(qty=${v.qty})`).join('、')}`)

// ③ 单据扫描
const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound', PER],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', PER],
  ['生产领料单', '/jdy/v2/scm/inv_pick', PER],
  ['产品入库单', '/jdy/v2/scm/inv_product', PER],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', PER],
  ['采购退货单', '/jdy/v2/scm/pur_ret', 0],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound', 0],
  ['其他入库单', '/jdy/v2/scm/inv_other_in', 0],
  ['盘点单', '/jdy/v2/scm/inv_check_bill', 0],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout', 0],
  ['组装单', '/jdy/v2/scm/inv_assemble', 0],
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

say('\n③ 单据分录扫描')
const summary = []
const semiHitByCode = new Map()
const stockedHits = []
for (const [label, path, per] of DOCS) {
  const head = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1' })
  if (!head.ok) { say(`\n--- ${label} ${path}\n    ❌ ${String(head.error).slice(0, 100)}`); summary.push({ label, ok: false }); await sleep(180); continue }
  const total = Number(head.data?.count || 0)
  if (!total) { say(`\n--- ${label}: 金蝶该类型无任何已审核单据`); summary.push({ label, ok: true, total: 0 }); await sleep(180); continue }
  const pages = Math.max(1, Math.ceil(total / PAGE))
  // per=0 ⇒ 全量;否则沿历史均匀抽 per 张
  let bills = [], pageList = []
  if (!per) {
    pageList = Array.from({ length: pages }, (_, i) => i + 1)
    for (const pg of pageList) {
      const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: String(pg), page_size: String(PAGE) })
      if (r.ok) bills.push(...(r.data?.rows || []))
      await sleep(200)
    }
  } else {
    const need = Math.min(pages, Math.ceil(per / 2))
    pageList = [...new Set(Array.from({ length: need }, (_, i) => (need === 1 ? 1 : Math.round(1 + (i * (pages - 1)) / (need - 1)))))]
    for (const pg of pageList) {
      const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: String(pg), page_size: String(PAGE) })
      if (r.ok) { const rows = r.data?.rows || []; if (rows[0]) bills.push(rows[0]); if (rows.length > 1) bills.push(rows[rows.length - 1]) }
      await sleep(200)
    }
    bills = bills.slice(0, per)
  }
  let lines = 0, hitLines = 0, hitBills = 0
  const samples = [], dateList = []
  for (const b of bills) {
    const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(b.id) })
    if (!d.ok) { await sleep(160); continue }
    const ents = pickEntries(d.data)
    lines += ents.length
    let n = 0
    for (const e of ents) {
      const num = String(e.material_number || '').trim()
      if (!semiSet.has(num)) continue
      hitLines++; n++
      dateList.push(String(b.bill_date || ''))
      semiHitByCode.set(num, (semiHitByCode.get(num) || 0) + 1)
      if (stocked.has(num) && stockedHits.length < 40) stockedHits.push(`${label} ${b.bill_no}(${b.bill_date}) ${num} ${nameOf.get(num)} 数量=${e.qty ?? e.actual_qty ?? e.base_qty ?? ''} 仓=${e.stock_number || ''} 批号=${e.batch_no || '-'}`)
      if (samples.length < 10) samples.push(`${b.bill_no}(${b.bill_date}) ${num} ${e.material_name || nameOf.get(num) || ''} 数量=${e.qty ?? e.actual_qty ?? e.base_qty ?? ''} 仓=${e.stock_number || ''}`)
    }
    if (n) hitBills++
    await sleep(160)
  }
  say(`\n--- ${label}  ${path}  [${per ? '抽样' : '全量'}]`)
  say(`    已审核总数 ${total};扫描 ${bills.length} 张 / 分录 ${lines} 行`)
  say(`    **半成品分录 ${hitLines} 行 / ${hitBills} 张${dateList.length ? ` / 日期 ${dateList.sort()[0]} ~ ${dateList.sort().slice(-1)[0]}` : ''}**`)
  for (const s of samples) say(`      · ${s}`)
  summary.push({ label, ok: true, total, scanned: bills.length, lines, hitLines, hitBills, d0: dateList.sort()[0], d1: dateList.sort().slice(-1)[0] })
  await sleep(200)
}

say('\n④ 扫描到的半成品商品分布(命中次数)')
for (const [k, v] of [...semiHitByCode.entries()].sort((a, b) => b[1] - a[1])) say(`   · ${k} ${nameOf.get(k)} = ${v} 次${stocked.has(k) ? '  ←有库存' : ''}`)
say('\n⑤ 有库存半成品的出入库记录')
say(stockedHits.length ? stockedHits.map((s) => '   · ' + s).join('\n') : '   (本次扫描范围内没有命中)')

say('\n⑥ 小结')
for (const s of summary) say(`   · ${s.label}: ${!s.ok ? '接口不可用' : s.total === 0 ? '无单据' : `总 ${s.total},扫 ${s.scanned} 张/${s.lines} 行 → 半成品 ${s.hitLines} 行(${s.hitBills} 张)${s.hitLines ? ` ${s.d0}~${s.d1}` : ''}`}`)

writeFileSync(new URL('./_probe-kingdee-semi-1015c.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-semi-1015c.out.txt')
