/**
 * spikeWaterLayout.test.js —— 加标水自定义表格结构的解析与分格（2026-11-06 用户口径）
 *
 * 判据不是"能不能解析正常 JSON"，而是：**用户把 JSON 写坏了，单据还能不能正常出**。
 * 标准库内容是给人手改的，一个逗号写错就必须退回内置列集、而不是让整张单白屏。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseLayout, groupSegments, totalWidth, FALLBACK_COLS } from './spikeWaterLayout.js'

const GOOD = JSON.stringify({
  cols: [
    { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
    { key: '硫酸镁', label: '硫酸镁', w: 90, group: '试剂用量（g）' },
    { key: '二水氯化钙', label: '二水氯化钙', w: 100, group: '试剂用量（g）' },
    { key: '负责人', label: '负责人', w: 70, rowspan: 2 },
  ],
})

test('正常结构：列数/列名/分格都按标准库条目来', () => {
  const r = parseLayout(GOOD)
  assert.equal(r.ok, true)
  assert.equal(r.cols.length, 4)
  assert.equal(r.cols[1].label, '硫酸镁')
  assert.equal(r.cols[1].group, '试剂用量（g）')
  assert.equal(r.cols[0].group, undefined, '没写 group 的列不该凭空长出一个分格')
})

test('没分格的列自动补 rowspan:2（否则表头两行会把它挤掉半格）', () => {
  const r = parseLayout(GOOD)
  assert.equal(r.cols[0].rowspan, 2)
  assert.equal(r.cols[3].rowspan, 2)
  assert.equal(r.cols[1].rowspan, undefined, '有分格的列由分格占第一行，自己不再 rowspan')
})

test('JSON 写坏 → 退回内置列集，不抛错（标准库内容是人手改的）', () => {
  const r = parseLayout('{ cols: [ {key:"a"} ] }')
  assert.equal(r.ok, false)
  assert.match(r.reason, /JSON 解析失败/)
  assert.deepEqual(r.cols, FALLBACK_COLS, '坏了必须退回兜底，而不是空表')
})

test('空内容 / 没有有效列 / 缺 cols → 都退回内置列集', () => {
  for (const bad of ['', null, undefined, '{}', '{"cols":[]}', '{"cols":[{"label":"只有名字"}]}']) {
    const r = parseLayout(bad)
    assert.equal(r.ok, false, JSON.stringify(bad) + ' 应判为不可用')
    assert.deepEqual(r.cols, FALLBACK_COLS)
  }
})

test('group 分段：相邻同名合并，空 group 自占两行', () => {
  const { cols } = parseLayout(GOOD)
  const segs = groupSegments(cols)
  assert.deepEqual(segs.map((s) => s.group), ['', '试剂用量（g）', ''])
  assert.equal(segs[1].span, 2, '两列同 group 要合并成一格')
  assert.equal(segs[0].span, 0, '无分格列 span=0（自占两行）')
})

test('同名 group 不相邻 → 各成一段（不能把中间隔着的列也吞进分格）', () => {
  const { cols } = parseLayout(JSON.stringify({
    cols: [
      { key: 'a', group: 'G1' }, { key: 'b' }, { key: 'c', group: 'G1' },
    ],
  }))
  const segs = groupSegments(cols)
  assert.deepEqual(segs.map((s) => s.span), [1, 0, 1], '被 b 隔开的两段 G1 不能合并')
})

test('总宽按列宽求和（纸面网格要按它分配）', () => {
  const { cols } = parseLayout(GOOD)
  assert.equal(totalWidth(cols), 350)
  assert.equal(totalWidth([{ w: 0 }, { w: -5 }, {}]), 270, '非法宽度按默认 90 计')
})
