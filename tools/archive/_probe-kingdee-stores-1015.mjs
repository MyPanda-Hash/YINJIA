/**
 * 只读探针(2026-10-15):金蝶账套**到底有几个仓库**——档案接口 vs 实况(库存/单据里出现的仓库)。
 *
 * 由来:/jdy/v2/bd/store 只回 6 个仓库,但 /jdy/v2/scm/inventory 出现过档案里没有的 `YJ-05/B仓`
 *       ⇒ 不能只凭档案接口下结论。本探针从四个来源交叉取证,合并去重:
 *       ① 仓库档案 /jdy/v2/bd/store(并试更大 page_size / 各分页);
 *       ② 现存量 /jdy/v2/inv/inv_inventory_ims 的 stock_* 与 **仓位 sp_*** 取值;
 *       ③ 商品库存 /jdy/v2/scm/inventory 的 stock_*(全量分页);
 *       ④ 各类出入库单明细分录里的 stock_ 与 sp_ 字段(抽样若干张)。
 *
 * 只读。用法: node tools/archive/_probe-kingdee-stores-1015.mjs
 * 产物: tools/archive/_probe-kingdee-stores-1015.out.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isSemi = (s) => /半成品|半制品|在制品|WIP/i.test(String(s || ''))

// 汇总器:仓库 → 出现在哪些来源
const seen = new Map()
const mark = (num, name, src) => {
  const k = `${num || '(空)'}|${name || '(空)'}`
  if (!seen.has(k)) seen.set(k, { num, name, srcs: new Set() })
  seen.get(k).srcs.add(src)
}
const spSeen = new Map()
const markSp = (num, name, store) => {
  const k = `${num || '(空)'}|${name || '(空)'}`
  if (!spSeen.has(k)) spSeen.set(k, { num, name, stores: new Set() })
  if (store) spSeen.get(k).stores.add(store)
}

say('=== 金蝶真实账套:仓库清点(档案 vs 实况,只读)===')
say(`账套 clientId=${cfg.clientId}   时间 ${new Date().toISOString()}`)

// ① 档案
say('\n=== ① 仓库档案 /jdy/v2/bd/store ===')
for (const [label, q] of [['默认(200)', { page: '1', page_size: '200' }], ['page_size=500', { page: '1', page_size: '500' }], ['page_size=2000', { page: '1', page_size: '2000' }], ['带 enable 过滤', { page: '1', page_size: '200', enable: '1' }]]) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/store', q)
  say(`  ${label.padEnd(18)} → ${r.ok ? `count=${r.data?.count} rows=${(r.data?.rows || []).length}` : String(r.error).slice(0, 80)}`)
  if (r.ok) for (const s of (r.data?.rows || [])) mark(s.number, s.name, '仓库档案')
  await sleep(200)
}

// ② 现存量(含仓位 sp_*)
say('\n=== ② 现存量 /jdy/v2/inv/inv_inventory_ims ===')
let n2 = 0
for (let p = 1; p <= 25; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const x of rows) { n2++; mark(x.stock_number, x.stockid_name, '现存量'); markSp(x.sp_number, x.sp_name, `${x.stock_number}/${x.stockid_name}`) }
  if (rows.length < 200) break
  await sleep(150)
}
say(`  扫描 ${n2} 行`)

// ③ 商品库存(全量;⚠ 实测每页上限 100,按 200 判页会只扫 1 页)
say('\n=== ③ 商品库存 /jdy/v2/scm/inventory ===')
let n3 = 0
const PS3 = 100
for (let p = 1; p <= 80; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inventory', { page: String(p), page_size: String(PS3) })
  if (!r.ok) { say(`  ❌ 第${p}页 ${String(r.error).slice(0, 80)}`); break }
  const rows = r.data?.rows || []
  for (const x of rows) { n3++; mark(x.stock_number, x.stock_name, '商品库存'); markSp(x.sp_number, x.sp_name, `${x.stock_number}/${x.stock_name}`) }
  if (rows.length < PS3) break
  await sleep(150)
}
say(`  扫描 ${n3} 行(count=${(await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inventory', { page: '1', page_size: '1' })).data?.count})`)

// ④ 单据明细里的仓库(每类抽 6 张,沿历史)
say('\n=== ④ 出入库单据明细里的仓库(抽样)===')
const DOCS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['生产领料单', '/jdy/v2/scm/inv_pick'],
  ['产品入库单', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill'],
]
for (const [label, path] of DOCS) {
  const head = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1' })
  if (!head.ok) { say(`  ❌ ${label}: ${String(head.error).slice(0, 70)}`); await sleep(160); continue }
  const total = Number(head.data?.count || 0)
  if (!total) { say(`  · ${label}: 无单据`); await sleep(160); continue }
  const pages = Math.max(1, Math.ceil(total / 100))
  const pageList = [...new Set([1, Math.ceil(pages / 2), pages].filter((x) => x >= 1 && x <= pages))]
  let n = 0
  for (const pg of pageList) {
    const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: String(pg), page_size: '5' })
    if (!r.ok) continue
    for (const b of (r.data?.rows || []).slice(0, 2)) {
      const d = await kingdeeTryGet(cfg, token, `${path}_detail`, { id: String(b.id) })
      for (const e of (d.ok ? (d.data?.material_entity || []) : [])) { mark(e.stock_number, e.stock_name, `${label}单据`); markSp(e.sp_number, e.sp_name, `${e.stock_number || ''}`); n++ }
      await sleep(150)
    }
    await sleep(150)
  }
  say(`  · ${label}: 单据 ${total} 张,取到分录 ${n} 行`)
  await sleep(160)
}

say('\n=== ⑤ 合并结果:实际出现过的仓库 ===')
say('| 编码 | 名称 | 出现来源 | 含半成品字样 |')
say('|---|---|---|---|')
for (const v of [...seen.values()].sort((a, b) => String(a.num).localeCompare(String(b.num)))) {
  say(`| ${v.num} | ${v.name} | ${[...v.srcs].join('、')} | ${isSemi(v.name) ? '✅' : ''} |`)
}
const semiWh = [...seen.values()].filter((v) => isSemi(v.name))
say(`\n  ⇒ 含「半成品/在制品」字样的仓库: ${semiWh.length ? semiWh.map((v) => `${v.num} ${v.name}`).join('、') : '**没有**'}`)

say('\n=== ⑥ 实际出现过的仓位(金蝶「仓位」维度)===')
if (!spSeen.size) say('  (无)')
for (const v of [...spSeen.values()]) say(`  · ${v.num} | ${v.name} | 所属仓库: ${[...v.stores].join('、')}${isSemi(v.name) ? '  ←含半成品字样' : ''}`)

writeFileSync(new URL('./_probe-kingdee-stores-1015.out.txt', import.meta.url), out.join('\n') + '\n', 'utf8')
console.log('\n[产物] tools/archive/_probe-kingdee-stores-1015.out.txt')
