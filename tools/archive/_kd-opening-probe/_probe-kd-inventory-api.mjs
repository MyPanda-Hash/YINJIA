/**
 * 金蝶「库存/期初」类接口探测(只读,真实账套 359797)
 *
 * 目的:回答「能否按 2026-09-01 之前的时点取库存作为期初」
 *   ① 纯现存量接口 inv_inventory_ims 是否支持日期参数?
 *   ② 有没有「收发存/进出存汇总表」接口可给期初余额?
 *   ③ 单据族接口的日期过滤能力(用单据算期初需要它)
 *   ④ 仓库/批次的维度键长什么样(映射到 kucun 的 wzdm/ckdm/lot_no)
 *
 * 用法:node tools/archive/_kd-opening-probe/_probe-kd-inventory-api.mjs [--full]
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
console.log(`账套 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId} domain=${cfg.domain}`)
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const show = (o) => JSON.stringify(o, null, 1).slice(0, 1200)

// ── ① 现存量接口:基础形态 + 日期参数试探 ─────────────────────────
console.log('\n========== ① /jdy/v2/inv/inv_inventory_ims ==========')
const base = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: '1', page_size: '2' })
if (base.ok) {
  console.log('基线(无日期参数) OK,键集:', Object.keys(base.data || {}))
  console.log('rows[0]:', show((base.data.rows || [])[0]))
} else console.log('基线失败:', base.error)

const dateKeys = ['start_date', 'end_date', 'date', 'bill_date', 'begin_date', 'endDate',
  'startDate', 'period', 'year', 'month', 'as_of_date', 'stock_date', 'filter_date']
const before = base.ok ? (base.data.count ?? base.data.total ?? null) : null
for (const k of dateKeys) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims',
    { page: '1', page_size: '2', [k]: '2025-01-01' })
  const after = r.ok ? (r.data.count ?? r.data.total ?? null) : null
  const flag = r.ok ? (String(after) !== String(before) ? '★count变化' : 'count不变') : '不支持'
  console.log(`  ${k.padEnd(14)} → ${r.ok ? 'HTTP OK' : 'HTTP ' + r.error.slice(0, 60)}  ${flag} (base=${before} now=${after})`)
  await sleep(60)
}

// ── ② 收发存类报表接口候选 ────────────────────────────────────────
console.log('\n========== ② 报表类接口候选(收发存/进出存/期初) ==========')
const paths = [
  '/jdy/v2/scm/inv_detail',                    // 官方文档:商品收发明细表列表
  '/jdy/v2/scm/inv_balance',                   // 商品收发汇总表(猜)
  '/jdy/v2/scm/inv_balance_summary',
  '/jdy/v2/scm/inv_summary',
  '/jdy/v2/scm/inv_stock_summary',
  '/jdy/v2/scm/inv_in_out_summary',
  '/jdy/v2/scm/inv_period_balance',
  '/jdy/v2/scm/inv_begin_balance',
  '/jdy/v2/scm/inv_opening',
  '/jdy/v2/inv/inv_balance',
  '/jdy/v2/inv/inv_in_out_summary',
  '/jdy/v2/inv/inv_report',
  '/jdy/v2/inv/inv_inventory',
  '/jdy/v2/inv/inv_inventory_detail',
  '/jdy/v2/scm/inventory',                     // 商品库存(已用于半成品取证)
  '/jdy/v2/inv/inv_opening_balance',
  '/jdy/v2/scm/inv_init_balance',
]
for (const p of paths) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '2' })
  const cnt = r.ok ? (r.data && (r.data.count ?? r.data.total)) : null
  console.log(`  ${p.padEnd(34)} → ${r.ok ? `OK  keys=${Object.keys(r.data || {}).join(',')} count=${cnt}` : r.error.slice(0, 80)}`)
  await sleep(80)
}

// ── ③ 单据族日期过滤(用单据算期初的前提)────────────────────────
console.log('\n========== ③ 出入库单据接口的日期过滤 ==========')
const docs = [
  ['采购入库单', '/jdy/v2/scm/inv_purchase'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['生产领料单', '/jdy/v2/scm/inv_pick'],
  ['产品入库单', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['盘点单', '/jdy/v2/scm/inv_check'],
  ['调拨单', '/jdy/v2/scm/inv_transfer'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound'],
  ['采购退货单', '/jdy/v2/scm/pur_return'],
]
for (const [name, p] of docs) {
  const all = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '2' })
  const withDate = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '2', start_date: '2025-01-01', end_date: '2025-12-31' })
  const a = all.ok ? (all.data.count ?? all.data.total) : null
  const b = withDate.ok ? (withDate.data.count ?? withDate.data.total) : '不支持'
  console.log(`  ${name.padEnd(6)} ${p.padEnd(28)} 全集=${String(a).padStart(6)}  2025全年=${String(b).padStart(6)}`)
  await sleep(80)
}
console.log('  (2025全年显著小于全集 ⇒ 该接口支持 start_date/end_date 过滤,可用于按期间取数)')
console.log('\n完成。')
