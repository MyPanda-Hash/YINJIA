/**
 * materialKindMap.test.js —— X烧结料位 → 档案类别的预筛选口径  2026-10-30
 *
 * 基准是真实单据 T205-X冰箱炭棒-26102901.xlsx 里那 4 个物料：
 *   粉料1 专用炭X2（80-200）   → 炭粉
 *   粉料2 专用炭X5(80-250目）  → 炭粉
 *   粉料3 BK1-D/10             → 功能料-粉末
 *   胶粉1 M3-D胶粉             → 胶粉
 * 若粉料位只允许「炭粉」，粉料3 那类功能粉料就选不出来 —— 这是这份映射存在的原因。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { kindsOfXsinterRow, rowHasKindFilter } from './materialKindMap.js'

test('① 粉料位同时允许 炭粉 与 功能料-粉末（T205 的粉料1/2 是炭粉、粉料3 是功能料-粉末）', () => {
  for (const k of ['粉料1', '粉料2', '粉料3', '粉料4', '粉料5']) {
    assert.deepEqual(kindsOfXsinterRow(k), ['炭粉', '功能料-粉末'], k)
  }
})

test('② 胶粉位只允许 胶粉（T205 的胶粉1 = M3-D胶粉）', () => {
  for (const k of ['胶粉1', '胶粉2']) {
    assert.deepEqual(kindsOfXsinterRow(k), ['胶粉'], k)
  }
})

test('③ 颗粒料位只允许 功能料-颗粒', () => {
  for (const k of ['颗粒料1', '颗粒料2', '颗粒料3']) {
    assert.deepEqual(kindsOfXsinterRow(k), ['功能料-颗粒'], k)
  }
})

test('④ 认不出的行不打预筛（退回手工输入，而不是给空候选让人以为没数据）', () => {
  assert.deepEqual(kindsOfXsinterRow('未知料'), [])
  assert.deepEqual(kindsOfXsinterRow(''), [])
  assert.deepEqual(kindsOfXsinterRow(null), [])
  assert.equal(rowHasKindFilter('粉料1'), true)
  assert.equal(rowHasKindFilter('未知料'), false)
})

test('⑤ 返回的是副本：调用方改动不会污染下一行', () => {
  const a = kindsOfXsinterRow('粉料1')
  a.push('成品')
  assert.deepEqual(kindsOfXsinterRow('粉料1'), ['炭粉', '功能料-粉末'])
})

test('⑥ 每个返回词都是 bs_inv.所属类别 的真实取值（不许造词）', () => {
  // 实测档案 8 类里的 4 个配方可用类别
  const REAL = new Set(['炭粉', '胶粉', '功能料-粉末', '功能料-颗粒'])
  for (const k of ['粉料1', '胶粉1', '颗粒料1']) {
    for (const kind of kindsOfXsinterRow(k)) {
      assert.ok(REAL.has(kind), `${k} 返回了档案里不存在的类别：${kind}`)
    }
  }
})
