/**
 * 拉取前侦察(2026-10-14):金蝶真实账套 —— ① 列表接口支持哪些**时间过滤**参数;② 9/1 至今各类单据**有多少条**。
 *
 * 为什么要先探:拉取脚本要按「9 月到现在」筛,而金蝶列表接口的时间过滤键名各接口不一
 *   (仓库既有同步用的是 modify_start_time/modify_end_time 毫秒时间戳 + bill_status);
 *   猜错的表现是**过滤静默失效**(返回全量),量级差一个数量级 ⇒ 必须先用 count 验证过滤是否真的生效。
 *
 * 只读(全部 GET)。用法: node tools/archive/_probe-kingdee-range-count-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-range-count-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 「9 月到现在」的口径:2026-09-01 00:00(本地)→ 当前
const START = new Date('2026-09-01T00:00:00+08:00')
const NOW = new Date()
const startMs = String(START.getTime())
const endMs = String(NOW.getTime() + 86400000)
const startDate = '2026-09-01'
const endDate = NOW.toISOString().slice(0, 10)

const DOCS = [
  ['采购订单', '/jdy/v2/scm/pur_order'],
  ['销售订单', '/jdy/v2/scm/sal_order'],
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['生产领料单(材料出库)', '/jdy/v2/scm/inv_pick'],
  ['产品入库单(成品入库)', '/jdy/v2/scm/inv_product'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
]

const out = []
const say = (s) => { out.push(s); console.log(s) }
say('# 金蝶拉取前侦察:时间过滤口径 + 9/1 至今数据量')
say('')
say(`- 账套:惠州市银嘉环保(outerInstanceId ${cfg.outerInstanceId},只读)`)
say(`- 区间:${startDate} 00:00 ~ ${endDate}(现在)`)
say(`- 抓取时间:${new Date().toISOString()}`)
say('')

say('## 一、时间过滤参数探测(以采购入库单为例,看 count 是否随过滤变化)')
say('')
const base = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '1' })
say(`- 无过滤(全量)            : count=${base.ok ? base.data.count : '❌'}`)
await sleep(250)
const variants = [
  ['bill_date_start/end', { bill_date_start: startDate, bill_date_end: endDate }],
  ['create_time_start/end(毫秒)', { create_time_start: startMs, create_time_end: endMs }],
  ['modify_start_time/end(毫秒)', { modify_start_time: startMs, modify_end_time: endMs }],
  ['create_start_time/end(毫秒)', { create_start_time: startMs, create_end_time: endMs }],
  ['date_start/end', { date_start: startDate, date_end: endDate }],
]
for (const [label, params] of variants) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '1', ...params })
  say(`- ${label.padEnd(26)}: ${r.ok ? 'count=' + r.data.count : '❌ ' + String(r.error).slice(0, 80)}`)
  await sleep(250)
}

say('')
say('## 二、按**生效的**过滤键统计(⚠ bill_date_* 被静默忽略,不能用)')
say('')
say('| 单据 | 接口 | 全量(已审核) | create 在区间 | modify 在区间 |')
say('|---|---|---|---|---|')
const RANGE_CREATE = { create_start_time: startMs, create_end_time: endMs }
const RANGE_MODIFY = { modify_start_time: startMs, modify_end_time: endMs }
const totals = {}
for (const [label, path] of DOCS) {
  const all = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1' })
  await sleep(200)
  const rc = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1', ...RANGE_CREATE })
  await sleep(200)
  const rm = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '1', ...RANGE_MODIFY })
  await sleep(200)
  const v = (x) => (x.ok ? x.data.count : '❌')
  totals[path] = { all: v(all), createInRange: v(rc), modifyInRange: v(rm) }
  say(`| ${label} | \`${path}\` | ${v(all)} | **${v(rc)}** | ${v(rm)} |`)
}

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-range-count-1014.md', import.meta.url), out.join('\n'), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-range-count-1014.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), startDate, endDate, totals }, null, 1), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-range-count-1014.{md,json}')
