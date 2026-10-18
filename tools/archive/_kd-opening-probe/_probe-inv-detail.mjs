/**
 * 深挖 /jdy/v2/scm/inv_detail(商品收发明细表)
 *   ① 字段全集(能不能给出 方向/数量/仓库/批次/单价)
 *   ② 日期参数支持(能否截到 2026-08-31 之前)
 *   ③ 能否按仓库/商品过滤
 *   ④ 与现存量 inv_inventory_ims 的勾稽(若 inv_detail 覆盖全部业务,则可精确回算任意时点)
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const P = '/jdy/v2/scm/inv_detail'
const cnt = (r) => (r.ok ? (r.data.count ?? r.data.total) : 'ERR:' + String(r.error).slice(0, 50))

console.log('========== ① 字段全集(第1页 3 行)==========')
const one = await kingdeeTryGet(cfg, token, P, { page: '1', page_size: '3' })
console.log('data 键:', Object.keys(one.data || {}))
for (const [i, r] of (one.data.rows || []).entries()) {
  console.log(`\n--- row[${i}] ---`)
  console.log(JSON.stringify(r, null, 1))
}

console.log('\n========== ② 日期参数试探(全集 = ' + cnt(one) + ') ==========')
const tries = [
  ['start_date/end_date 2025全年', { start_date: '2025-01-01', end_date: '2025-12-31' }],
  ['start_date/end_date 2026-01-01~08-31', { start_date: '2026-01-01', end_date: '2026-08-31' }],
  ['start_date/end_date 2026-09-01~12-31', { start_date: '2026-09-01', end_date: '2026-12-31' }],
  ['begin_date/end_date 2026-01-01~08-31', { begin_date: '2026-01-01', end_date: '2026-08-31' }],
  ['bill_date_begin/bill_date_end', { bill_date_begin: '2026-09-01', bill_date_end: '2026-12-31' }],
  ['date 2026-08-31', { date: '2026-08-31' }],
  ['start_date only 2026-09-01', { start_date: '2026-09-01' }],
]
for (const [name, p] of tries) {
  const r = await kingdeeTryGet(cfg, token, P, { page: '1', page_size: '1', ...p })
  console.log(`  ${name.padEnd(38)} → ${cnt(r)}`)
  await sleep(80)
}

console.log('\n========== ③ 维度过滤 ==========')
for (const [name, p] of [
  ['material_number=3-01-16-0012', { material_number: '3-01-16-0012' }],
  ['stock_number=YCL-01', { stock_number: 'YCL-01' }],
  ['stock_id', { stock_id: '2243772584451731456' }],
]) {
  const r = await kingdeeTryGet(cfg, token, P, { page: '1', page_size: '1', ...p })
  console.log(`  ${name.padEnd(32)} → ${cnt(r)}`)
  await sleep(80)
}

console.log('\n========== ④ 全量拉取(分页)并按字段汇总 ==========')
const all = []
for (let page = 1; page <= 400; page++) {
  const r = await kingdeeTryGet(cfg, token, P, { page: String(page), page_size: '100' })
  if (!r.ok) { console.log('  第', page, '页失败:', r.error.slice(0, 80)); break }
  const rows = r.data.rows || []
  all.push(...rows)
  if (rows.length < 100) break
  await sleep(70)
}
console.log(`  拉到 ${all.length} 行(声明 count=${cnt(one)})`)
const keys = new Set()
all.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)))
console.log('  实际出现的键:', [...keys].sort().join(', '))

// 找方向/数量/日期字段
const sample = all[0] || {}
console.log('\n  首行:', JSON.stringify(sample).slice(0, 800))
