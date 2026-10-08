import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  niceMax,
  scaleCapacity,
  toneOf,
  fmtCompact,
  capacitySubText,
  CAPACITY_PERIODS,
} from './capacityBars.js'

/**
 * 这组断言守的是 2026-10-08 用户需求:
 *   「把生产方面的日产能对比加上可以 tap 切换周产能、月产能、年产能对比,
 *     然后柱状图应该是竖向排列」
 *
 * 为什么单独成文件:柱高/刻度这类几何口径必须是**纯函数**,否则只能靠肉眼看图判断对错
 * —— 8 条产线 × 4 个周期各画一遍、每次改样式都人眼复核,迟早画错且没人发现。
 */

test('CAPACITY_PERIODS: 四档周期且第一档是日(默认选中)', () => {
  assert.deepEqual(
    CAPACITY_PERIODS.map((p) => p.key),
    ['day', 'week', 'month', 'year'],
  )
  assert.equal(CAPACITY_PERIODS[0].key, 'day')
  // 每档都要有中文标签(显示层走 tt(),这里只保底可读)
  for (const p of CAPACITY_PERIODS) assert.ok(p.label && p.label.length > 0)
})

test('niceMax: 向上取整到 1/2/5×10^n,空数据退化为 1(不能除零)', () => {
  assert.equal(niceMax(0), 1)
  assert.equal(niceMax(-5), 1)
  assert.equal(niceMax(1), 1)
  assert.equal(niceMax(2), 2)
  assert.equal(niceMax(9), 10)
  assert.equal(niceMax(87), 100)
  assert.equal(niceMax(1234), 2000)
  assert.equal(niceMax(5000), 5000)
})

test('toneOf: 与既有子弹条同口径(<80 ok / 80-100 warn / >100 over / 无上限 na)', () => {
  assert.equal(toneOf(0), 'ok')
  assert.equal(toneOf(79), 'ok')
  assert.equal(toneOf(80), 'warn')
  assert.equal(toneOf(100), 'warn')
  assert.equal(toneOf(101), 'over')
  assert.equal(toneOf(null), 'na')
  assert.equal(toneOf(undefined), 'na')
})

test('scaleCapacity: 实际与上限共用同一刻度,按行最大值(含上限)定轴', () => {
  const out = scaleCapacity([
    { name: '一号线', actual: 300, limit: 500, pct: 60 },
    { name: '二号线', actual: 900, limit: 400, pct: 225 },
  ])
  // 轴上限取四者最大 900 → niceMax = 1000
  assert.equal(out.max, 1000)
  assert.equal(out.rows.length, 2)
  assert.deepEqual(
    out.rows.map((r) => r.actualPct),
    [30, 90],
  )
  assert.deepEqual(
    out.rows.map((r) => r.limitPct),
    [50, 40],
  )
  // 逐行判定色:超上限的那条才变红
  assert.deepEqual(
    out.rows.map((r) => r.tone),
    ['ok', 'over'],
  )
})

test('scaleCapacity: 未配日产能上限的行(limit=null)不画上限柱、标记 na', () => {
  const out = scaleCapacity([{ name: '临时线', actual: 120, limit: null, pct: null }])
  assert.equal(out.max, 200) // 轴只由 actual 决定
  assert.equal(out.rows[0].actualPct, 60)
  assert.equal(out.rows[0].limitPct, 0)
  assert.equal(out.rows[0].tone, 'na')
})

test('scaleCapacity: 空列表不炸(除零保护),顺序保持后端下发顺序', () => {
  assert.deepEqual(scaleCapacity([]), { max: 1, rows: [] })
  assert.deepEqual(scaleCapacity(null), { max: 1, rows: [] })
  const out = scaleCapacity([
    { name: 'B线', actual: 10, limit: 100, pct: 10 },
    { name: 'A线', actual: 90, limit: 100, pct: 90 },
  ])
  assert.deepEqual(
    out.rows.map((r) => r.name),
    ['B线', 'A线'],
  )
})

test('scaleCapacity: 超上限的柱高帽在 100% 以内(比例失真比截断更误导)', () => {
  const out = scaleCapacity([{ name: '爆线', actual: 3000, limit: 100, pct: 3000 }])
  const r = out.rows[0]
  assert.ok(r.actualPct <= 100, `actualPct 应 ≤100,实际 ${r.actualPct}`)
  assert.ok(r.limitPct >= 0 && r.limitPct <= 100)
})

test('fmtCompact: 柱顶数值 ≤4 字符宽度,过万缩「x.x万」', () => {
  assert.equal(fmtCompact(0), '0')
  assert.equal(fmtCompact(999), '999')
  assert.equal(fmtCompact(1200), '1,200')
  assert.equal(fmtCompact(12000), '1.2万')
  assert.equal(fmtCompact(20000), '2万')
})

test('capacitySubText: 区间与口径同源 —— 口径取「数据自己的周期」而不是当前选中的 tab', () => {
  // 切换瞬间的混搭:点了「周产能」但数据还是日档的 —— 必须按数据(日)标注,
  // 否则标题会写成「数据区间 2026-08-26 · 上限 = 日产能 × 7 天」这种自相矛盾的组合
  const stale = { period: 'day', from: '2026-08-26', to: '2026-08-26' }
  assert.equal(capacitySubText(stale, 'week'), '数据区间 2026-08-26 · 上限 = 日产能 × 1 天')
  // 数据到位后:区间与折算天数配套
  assert.equal(
    capacitySubText({ period: 'week', from: '2026-08-24', to: '2026-08-30' }, 'week'),
    '数据区间 2026-08-24 ~ 2026-08-30 · 上限 = 日产能 × 7 天',
  )
  // 月档折算不写死 ×30,而是「按当月自然日」
  assert.equal(
    capacitySubText({ period: 'month', from: '2026-08-01', to: '2026-08-31' }, 'month'),
    '数据区间 2026-08-01 ~ 2026-08-31 · 上限 = 日产能 × 当月自然日',
  )
  // 没有数据(首屏/失败)时只留口径,不编造区间
  assert.equal(capacitySubText({ rows: [] }, 'day'), '上限 = 日产能 × 1 天')
  assert.equal(capacitySubText(null, 'year'), '上限 = 日产能 × 365 天')
})
