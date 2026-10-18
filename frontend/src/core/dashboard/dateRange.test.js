import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESETS, defaultRange, isValidRange, matchPreset, normalizeRange, presetRange,
  rangeDays, rangeLabel, rangeQuery, bucketLabel, todayStr,
} from './dateRange.js'

/**
 * dateRange.test.js — 看板时间区间纯函数(2026-10-16 「所有看板加时间区间」)
 * 口径必须与后端 DashboardStatsService.Range 对齐:闭区间、≤31 天按天、>31 天按周、缺省近 30 天。
 */

const NOW = new Date(2026, 9, 16, 15, 30) // 2026-10-16(周五)

test('快捷区间:今日/本周/本月/近7天/近30天/上月 的边界', () => {
  assert.deepEqual(presetRange('today', NOW), { from: '2026-10-16', to: '2026-10-16' })
  // 2026-10-16 是周五 ⇒ 本周 = 周一 10-12 ~ 今天
  assert.deepEqual(presetRange('week', NOW), { from: '2026-10-12', to: '2026-10-16' })
  assert.deepEqual(presetRange('month', NOW), { from: '2026-10-01', to: '2026-10-16' })
  assert.deepEqual(presetRange('last7', NOW), { from: '2026-10-10', to: '2026-10-16' })
  assert.deepEqual(presetRange('last30', NOW), { from: '2026-09-17', to: '2026-10-16' })
  assert.deepEqual(presetRange('lastMonth', NOW), { from: '2026-09-01', to: '2026-09-30' })
  // 周日归属上一周(不能把周日算成本周第一天)
  const sun = new Date(2026, 9, 18)
  assert.deepEqual(presetRange('week', sun), { from: '2026-10-12', to: '2026-10-18' })
})

test('缺省区间 = 近 30 天(含今天),共 30 天', () => {
  const d = defaultRange(NOW)
  assert.deepEqual(d, { from: '2026-09-17', to: '2026-10-16' })
  assert.equal(rangeDays(d), 30)
})

test('非法/反序/超长区间被规范化,不会把坏参数发给后端', () => {
  assert.equal(isValidRange({ from: '2026-10-01', to: '2026-10-16' }), true)
  assert.equal(isValidRange({ from: '2026-10-16', to: '2026-10-01' }), true) // 反序也算"可解析",由 normalize 纠正
  assert.equal(isValidRange({ from: '2026/10/01', to: '2026-10-16' }), false)
  assert.equal(isValidRange({ from: '', to: '2026-10-16' }), false)
  assert.equal(isValidRange(null), false)
  assert.deepEqual(normalizeRange(null, NOW), defaultRange(NOW))
  assert.deepEqual(normalizeRange({ from: '2026-10-16', to: '2026-10-01' }, NOW), { from: '2026-10-01', to: '2026-10-16' })
  // 超过 366 天 ⇒ 截到 to 往前的 366 天
  assert.deepEqual(normalizeRange({ from: '2020-01-01', to: '2026-10-16' }, NOW), { from: '2025-10-16', to: '2026-10-16' })
})

test('分桶口径:≤31 天按天、>31 天按周(与后端一致)', () => {
  assert.equal(bucketLabel({ from: '2026-10-01', to: '2026-10-31' }), '按天')  // 31 天
  assert.equal(bucketLabel({ from: '2026-10-01', to: '2026-11-01' }), '按周')  // 32 天
})

test('请求参数与展示文案', () => {
  assert.deepEqual(rangeQuery({ from: '2026-10-01', to: '2026-10-16' }, NOW), { from: '2026-10-01', to: '2026-10-16' })
  assert.deepEqual(rangeQuery(null, NOW), defaultRange(NOW))
  assert.equal(rangeLabel({ from: '2026-09-17', to: '2026-10-16' }), '2026-09-17 ~ 2026-10-16(30 天)')
  assert.equal(todayStr(NOW), '2026-10-16')
})

test('命中哪个快捷项:命中返回 key,否则 custom', () => {
  assert.equal(matchPreset(presetRange('last7', NOW), NOW), 'last7')
  assert.equal(matchPreset(presetRange('month', NOW), NOW), 'month')
  assert.equal(matchPreset({ from: '2026-09-01', to: '2026-10-16' }, NOW), 'custom')
  assert.equal(PRESETS.length, 6)
})
