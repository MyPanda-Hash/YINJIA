/**
 * 只读探针(2026-10-15):金蝶真实账套里**有没有「半成品库」或相当于半成品库的仓库**。
 *
 * 用户口径:不看商品分类,先看仓库 —— 金蝶的出入库单据里有没有半成品库/相当于半成品库的仓库,
 *           再据此判断半成品数据在哪。
 *
 * 做四件事(全只读 GET):
 *   ① 仓库档案 /jdy/v2/bd/store 全量 + 仓库分类 /jdy/v2/bd/store_group(看有没有「半成品仓」这种分类);
 *   ② 仓位档案 /jdy/v2/bd/space(或 sp_*)候选探测 + 名称含半成品的;
 *   ③ 现存量 /jdy/v2/inv/inv_inventory_ims:按**仓库**汇总行数与数量,并单独列出「分类=半成品」的仓库分布;
 *   ④ 出入库单据里半成品的**仓库落点**:对已确认含半成品的单据(第四版探针的 12 张)打印其仓库。
 *
 * 用法: node tools/archive/_probe-kingdee-semi-wh-1015.mjs
 * 产物: tools/archive/_probe-kingdee-semi-wh-1015.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isSemi = (s) => /半成品|半制品|在制品|WIP|车间/i.test(String(s || ''))

say('=== 金蝶真实账套:有没有「半成品库」(只读)===')
say(`账套 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}   时间 ${new Date().toISOString()}`)

// ① 仓库档案 + 仓库分类
say('\n=== ① 仓库档案 /jdy/v2/bd/store(全量)===')
const stores = []
for (let p = 1; p <= 10; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/store', { page: String(p), page_size: '200' })
  if (!r.ok) { say(`  ❌ ${String(r.error).slice(0, 120)}`); break }
  const rows = r.data?.rows || []
  stores.push(...rows)
  if (rows.length < 200) break
  await sleep(180)
}
say(`  仓库总数 = ${stores.length}`)
say('  | 编码 | 名称 | 分类 | 启用 | id |')
say('  |---|---|---|---|---|')
for (const s of stores) say(`  | ${s.number} | ${s.name} | ${s.group_name || '(无分类)'} | ${s.enable === '1' ? '启用' : s.enable} | ${s.id} |`)
const semiStores = stores.filter((s) => isSemi(s.name) || isSemi(s.group_name))
say(`  ⇒ 名称/分类含「半成品|在制品|车间」的仓库: ${semiStores.length ? semiStores.map((s) => `${s.number} ${s.name}${s.group_name ? '(' + s.group_name + ')' : ''}`).join('、') : '(无)'}`)
await sleep(200)

say('\n=== ①b 仓库分类档案(候选路径)===')
for (const p of ['/jdy/v2/bd/store_group', '/jdy/v2/bd/warehouse_group', '/jdy/v2/bd/stock_group']) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '100' })
  if (!r.ok) { say(`  ❌ ${p} → ${String(r.error).slice(0, 90)}`); await sleep(180); continue }
  const rows = r.data?.rows || []
  say(`  ✅ ${p} count=${r.data?.count}`)
  for (const g of rows) say(`     · ${g.number || ''} ${g.name}${isSemi(g.name) ? '   ←含半成品/车间字样' : ''}`)
  await sleep(180)
}

// ② 仓位档案(金蝶侧叫「仓位」,MES 对齐过 sp_id/sp_name/sp_number)
say('\n=== ② 仓位档案(候选路径)===')
for (const p of ['/jdy/v2/bd/space', '/jdy/v2/bd/store_space', '/jdy/v2/bd/stock_space']) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '200' })
  if (!r.ok) { say(`  ❌ ${p} → ${String(r.error).slice(0, 90)}`); await sleep(180); continue }
  const rows = r.data?.rows || []
  say(`  ✅ ${p} count=${r.data?.count};名称含半成品 ${rows.filter((x) => isSemi(x.name)).length} 个`)
  for (const x of rows.filter((y) => isSemi(y.name)).slice(0, 30)) say(`     · ${x.number} ${x.name} 仓=${x.store_name || x.store_number || ''}`)
  await sleep(180)
}

// ③ 现存量:按仓库汇总 + 半成品分类的落点
say('\n=== ③ 现存量 /jdy/v2/inv/inv_inventory_ims:按仓库 ===')
const byStore = new Map()
const semiByStore = new Map()
const semiRows = []
let rowsAll = 0
for (let p = 1; p <= 25; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '200' })
  if (!r.ok) { say(`  ❌ 第${p}页 ${String(r.error).slice(0, 90)}`); break }
  const rows = r.data?.rows || []
  for (const x of rows) {
    rowsAll++
    const k = `${x.stock_number}/${x.stockid_name}`
    const cur = byStore.get(k) || { rows: 0, qty: 0 }
    cur.rows++; cur.qty += Number(x.qty || 0); byStore.set(k, cur)
    if (String(x.material_category_name || '') === '半成品') {
      semiRows.push(x)
      const s = semiByStore.get(k) || { rows: 0, qty: 0 }; s.rows++; s.qty += Number(x.qty || 0); semiByStore.set(k, s)
    }
  }
  if (rows.length < 200) break
  await sleep(160)
}
say(`  库存行合计 ${rowsAll}`)
say('  | 仓库 | 库存行数 | 数量合计 |')
say('  |---|---|---|')
for (const [k, v] of [...byStore.entries()].sort((a, b) => b[1].rows - a[1].rows)) say(`  | ${k} | ${v.rows} | ${v.qty} |`)
say(`\n  分类=半成品 的库存行 ${semiRows.length} 行,落点仓库: ${[...semiByStore.entries()].map(([k, v]) => `${k}(${v.rows}行/${v.qty})`).join('、') || '(无)'}`)
for (const x of semiRows) say(`     · ${x.material_number} ${x.material_name} | ${x.stock_number}/${x.stockid_name} | 仓位=${x.sp_number || '-'}/${x.sp_name || '-'} | qty=${x.qty}`)

// ④ 已确认含半成品的单据 → 仓库落点
say('\n=== ④ 已确认含半成品的单据:仓库落点 ===')
const BILLS = [
  ['产品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20261006-00001'],
  ['产品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260926-00002'],
  ['产品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260920-00003'],
  ['产品入库单', '/jdy/v2/scm/inv_product', 'CPRK-20260907-00003'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20261010-00007'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260924-00009'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260912-00003'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260907-00001'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'XSCK-20260904-00022'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', 'QTCK-20260918-01132'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', 'QTCK-20260902-01095'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound', 'XSTH-20260209-00062'],
]
const semiNums = new Set(semiRows.map((x) => String(x.material_number)))
const whCount = new Map()
for (const [label, path, no] of BILLS) {
  const l = await kingdeeTryGet(cfg, token, path, { bill_no: no, page: '1', page_size: '5' })
  const bill = (l.data?.rows || []).find((r) => String(r.bill_no) === no)
  if (!bill) { say(`  ⚠ ${label} ${no} 未取到`); await sleep(160); continue }
  const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(bill.id) })
  const ents = d.ok ? (d.data?.material_entity || []) : []
  const hits = ents.filter((e) => semiNums.has(String(e.material_number || '').trim()) || e.material_category_name === '半成品')
  say(`  ${label} ${no} (${bill.bill_date}): 半成品分录 ${hits.length} 行`)
  for (const e of hits) {
    const k = `${e.stock_number || '(空)'}/${e.stock_name || '(空)'}`
    whCount.set(k, (whCount.get(k) || 0) + 1)
    say(`     · ${e.material_number} ${e.material_name} 数量=${e.qty} → 仓库 ${k} 仓位 ${e.sp_number || '-'}/${e.sp_name || '-'}`)
  }
  await sleep(160)
}
say(`\n  半成品出入库分录的仓库分布: ${[...whCount.entries()].map(([k, v]) => `${k} × ${v}`).join('、') || '(无)'}`)

say('\n=== ⑤ 小结 ===')
say(`  · 金蝶仓库 ${stores.length} 个:${stores.map((s) => `${s.number}${s.name}`).join('、')}`)
say(`  · 名称/分类含「半成品/在制品/车间」的仓库:${semiStores.length ? semiStores.map((s) => `${s.number} ${s.name}`).join('、') : '无'}`)
say(`  · 分类=半成品的库存:${semiRows.length} 行,落点 ${[...semiByStore.keys()].join('、') || '无'}`)
say(`  · 半成品出入库单据的仓库落点:${[...whCount.keys()].join('、') || '无'}`)

writeFileSync(new URL('./_probe-kingdee-semi-wh-1015.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物] tools/archive/_probe-kingdee-semi-wh-1015.out.txt')
