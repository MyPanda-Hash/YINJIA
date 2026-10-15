/**
 * chartLabels.test.js —— 折线图 X 轴抽稀与末点读数
 *
 * 钉子(2026-10-15 用户报「近 30 天趋势不够清晰」):
 *   30 个点全画标签会糊成一片;抽稀必须**首尾都在**(否则看不出区间),
 *   且取点位置要和折线的等距点位对齐(否则标签与线错位,比不抽还难看)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thinLabels, lastValues } from './chartLabels.js'

const series = (n) => Array.from({ length: n }, (_, i) => ({ date: `${i + 1}日`, added: i, done: n - i }))

test('n ≤ maxLabels 时原样全显示(对既有 7/12 点图表零影响)', () => {
  const d = series(7)
  const out = thinLabels(d, 8)
  assert.equal(out.length, 7)
  assert.deepEqual(out.map((x) => x.i), [0, 1, 2, 3, 4, 5, 6])
  assert.deepEqual(out.map((x) => x.date), d.map((x) => x.date))
})

test('n = maxLabels 时也全显示(不多不少)', () => {
  assert.equal(thinLabels(series(8), 8).length, 8)
})

test('30 个点 → 抽稀到 ≤ maxLabels 个', () => {
  const out = thinLabels(series(30), 8)
  assert.ok(out.length <= 8, `实际 ${out.length}`)
  assert.ok(out.length >= 5, `太少会看不出形状:${out.length}`)
})

test('抽稀后**首尾必含**(否则看不出区间起点/终点)', () => {
  const out = thinLabels(series(30), 8)
  assert.equal(out[0].i, 0)
  assert.equal(out[out.length - 1].i, 29)
  assert.equal(out[0].date, '1日')
  assert.equal(out[out.length - 1].date, '30日')
})

test('取点位置与折线等距点位对齐(round(k*(n-1)/(m-1))),不重复不越界', () => {
  const n = 30, m = 8
  const out = thinLabels(series(n), m)
  const want = []
  for (let k = 0; k < m; k++) want.push(Math.round((k * (n - 1)) / (m - 1)))
  assert.deepEqual(out.map((x) => x.i), [...new Set(want)])
  assert.ok(out.every((x) => x.i >= 0 && x.i < n))
  // 严格递增
  for (let i = 1; i < out.length; i++) assert.ok(out[i].i > out[i - 1].i, 'i 必须严格递增')
})

test('空数据 / 单点不炸', () => {
  assert.deepEqual(thinLabels([], 8), [])
  assert.deepEqual(thinLabels(null, 8), [])
  assert.equal(thinLabels(series(1), 8).length, 1)
})

test('lastValues:取最后一点的 added/done(图例里显示"最新值")', () => {
  const d = [{ date: 'a', added: 3, done: 1 }, { date: 'b', added: 7, done: 4 }]
  assert.deepEqual(lastValues(d), { added: 7, done: 4 })
})

test('lastValues:空数据按 0,不返回 undefined', () => {
  assert.deepEqual(lastValues([]), { added: 0, done: 0 })
  assert.deepEqual(lastValues(null), { added: 0, done: 0 })
})
