/**
 * extCols.test.js — 自定义列并入纸面列定义（纯函数）
 * 口径见 extCols.js 头注；用例直接对应 2026-11-11 用户要求：
 * 「测试数据字段要能新增列…最多 8 个…列还可以设计分叉…可以自己新建一个分组」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeExtCols, EXT_COL_DEFAULT_W } from './extCols.js'

const BASE_COLS = [
  { key: '测试时间', label: '测试时间' },
  { key: '水温（℃）', label: '水温（℃）' },
]
const BASE_SUB = [{ label: '口感测试', span: 2 }]

test('① 没有自定义列时原样返回（零波及既有 8 张表）', () => {
  const r = mergeExtCols({ cols: BASE_COLS, subHeads: BASE_SUB, detailFields: [] })
  assert.deepEqual(r.cols, BASE_COLS)
  assert.deepEqual(r.subHeads, BASE_SUB)
  assert.equal(r.addedCount, 0)
})

test('② 自定义列追加到末尾，沿用元数据列宽；缺省宽兜底', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '自定义A', place: 'detail', width: 150 },
      { dataName: '自定义B', place: 'detail' },
    ],
  })
  assert.equal(r.cols.length, 4)
  assert.deepEqual(r.cols.slice(2).map((c) => c.key), ['自定义A', '自定义B'])
  assert.equal(r.cols[2].w, 150)
  assert.equal(r.cols[3].w, EXT_COL_DEFAULT_W)
  assert.equal(r.addedCount, 2)
})

test('③ 带 colGroup 的自定义列 → 分叉表头多一格（自己新建分组）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [{ dataName: '浊度', place: 'detail', colGroup: '新增分析' }],
  })
  assert.deepEqual(r.subHeads, [
    { label: '口感测试', span: 2 },
    { label: '新增分析', span: 1 },
  ])
})

test('④ 同分组的相邻自定义列合并成一格（选同一个已有分组名时不会出现两个同名格）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '钠2', place: 'detail', colGroup: '新增分析' },
      { dataName: '镁2', place: 'detail', colGroup: '新增分析' },
    ],
  })
  assert.deepEqual(r.subHeads, [
    { label: '口感测试', span: 2 },
    { label: '新增分析', span: 2 },
  ])
})

test('⑤ 原表本来没有分叉、但自定义列要分组 ⇒ 补一格覆盖原有列的占位（否则表头短一截对不齐）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: [],
    detailFields: [{ dataName: '浊度', place: 'detail', colGroup: '新增分析' }],
  })
  assert.deepEqual(r.subHeads, [
    { label: '', span: 2 },      // 原有两列
    { label: '新增分析', span: 1 },
  ])
  // span 合计必须等于可见列数，否则 spreadSubHeads 会被截断
  assert.equal(r.subHeads.reduce((s, x) => s + x.span, 0), r.cols.length)
})

test('⑥ 原表没有分叉、自定义列也不分组 ⇒ 保持单行表头（不硬造分叉行）', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: [],
    detailFields: [{ dataName: '浊度', place: 'detail' }],
  })
  assert.deepEqual(r.subHeads, [])
  assert.equal(r.cols.length, 3)
})

test('⑦ 已经在静态列里的字段不重复追加；hidden / 非明细字段跳过', () => {
  const r = mergeExtCols({
    cols: BASE_COLS, subHeads: BASE_SUB,
    detailFields: [
      { dataName: '测试时间', place: 'detail' },     // 已在静态列
      { dataName: '隐藏列', place: 'detail', hidden: true },
      { dataName: '表头字段', place: 'header' },
      { dataName: '真新列', place: 'detail' },
    ],
  })
  assert.deepEqual(r.addedLabels, ['真新列'])
  assert.equal(r.cols.length, 3)
})

test('⑧ 不修改入参（免得住进 store 的配置被就地改坏）', () => {
  const cols = BASE_COLS.map((c) => ({ ...c }))
  const subs = BASE_SUB.map((s) => ({ ...s }))
  const colsCopy = JSON.parse(JSON.stringify(cols))
  const subsCopy = JSON.parse(JSON.stringify(subs))
  mergeExtCols({ cols, subHeads: subs, detailFields: [{ dataName: 'X', place: 'detail', colGroup: 'G' }] })
  assert.deepEqual(cols, colsCopy)
  assert.deepEqual(subs, subsCopy)
})
