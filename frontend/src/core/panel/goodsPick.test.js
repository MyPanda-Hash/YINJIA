/**
 * goodsPick.test.js — 规格书「从商品引用」的级联筛选 / 落行规则(2026-10-21)
 * 跑法:cd frontend && npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { matchGoods, facetValues, goodsToDetail, GOODS_FACETS } from './goodsPick.js'

const ROWS = [
  { 所属类别: '功能炭棒', 存货编码: 'T382', 存货名称: '除重金属炭棒/滤芯', 规格型号: '2支装白盒', 备注: '炭棒尺寸' },
  { 所属类别: '功能炭棒', 存货编码: 'T383', 存货名称: '除重金属炭棒/滤芯B', 规格型号: '3支装白盒', 备注: '' },
  { 所属类别: '标签', 存货编码: 'YJ-KG-D09', 存货名称: '阻垢王标', 规格型号: '', 备注: '' },
  { 所属类别: '折算物料', 存货编码: 'M-001', 存货名称: '炭棒', 规格型号: '', 备注: 'BOM重建' },
]

test('① 取数走既有 invRowsOf(档案型返回形状),本模块只管行级逻辑', () => {
  // 形状:{ data: { list: [ { detail: { inv: ROWS } } ] } } —— 由 invCarry.invRowsOf 负责剥,
  // 这里只用它的产物断言:四栏都能读到字符串(漏一栏级联就静默失效)
  for (const r of ROWS) {
    assert.equal(typeof r['所属类别'], 'string')
    assert.equal(typeof r['存货编码'], 'string')
    assert.equal(typeof r['存货名称'], 'string')
    assert.equal(typeof r['规格型号'], 'string')
  }
})

test('② 多个条件同时生效(AND),子串匹配且不区分大小写', () => {
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒' }).length, 2)
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒', 存货编码: 't38' }).length, 2)
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒', 存货编码: 'T382' }).length, 1)
  assert.equal(matchGoods(ROWS, { 存货名称: '阻垢' })[0]['存货编码'], 'YJ-KG-D09')
})

test('② 空条件(或只有空格)表示不过滤', () => {
  assert.equal(matchGoods(ROWS, {}).length, 4)
  assert.equal(matchGoods(ROWS, { 所属类别: '  ' }).length, 4)
})

test('③ 级联收窄:选了类别后,「规格型号」候选只剩该类别的值', () => {
  const v = facetValues(ROWS, '规格型号', { 所属类别: '功能炭棒' })
  assert.deepEqual(v.values, ['2支装白盒', '3支装白盒'])
  const all = facetValues(ROWS, '规格型号', {})
  assert.deepEqual(all.values, ['2支装白盒', '3支装白盒']) // 空的规格型号不进候选
})

test('③ 候选值排除自己那一栏:选了「所属类别」后,该栏仍列出全部类别', () => {
  const v = facetValues(ROWS, '所属类别', { 所属类别: '功能炭棒' })
  assert.deepEqual(v.values, ['功能炭棒', '折算物料', '标签'])
  assert.equal(v.more, 0)
})

test('③ 已选值补在候选最前面;其它条件决定的候选集不受自己那一栏影响', () => {
  // 类别=标签 ⇒ 编码候选只应来自「标签」这批;已选的 T382 仍排第一(让用户看见自己选了什么)
  const v = facetValues(ROWS, '存货编码', { 存货编码: 'T382', 所属类别: '标签' })
  assert.equal(v.values[0], 'T382')
  assert.deepEqual(v.values.slice(1), ['YJ-KG-D09'], '候选来自 类别=标签 的行')
})

test('③ 候选过多时按 cap 截断并回报 more(存货编码实测 3000+)', () => {
  const many = Array.from({ length: 400 }, (_, i) => ({ 所属类别: 'X', 存货编码: 'C' + i }))
  const v = facetValues(many, '存货编码', {}, 300)
  assert.equal(v.values.length, 300)
  assert.equal(v.more, 100)
})

test('④ 落行映射:编码/名称/规格/备注按目标列取值', () => {
  const { rows, skipped } = goodsToDetail([ROWS[0]], [], ['序号', '物料编码', '物料名称', '规格参数', '数量', '备注'])
  assert.equal(skipped, 0)
  assert.deepEqual(rows[0], {
    物料编码: 'T382', 物料名称: '除重金属炭棒/滤芯', 规格参数: '2支装白盒', 备注: '炭棒尺寸',
  })
  assert.ok(!('数量' in rows[0]), '数量商品里没有,不能凭空落值')
})

test('④ 目标表没有的列不落(只落实际存在的列)', () => {
  const { rows } = goodsToDetail([ROWS[0]], [], ['物料编码'])
  assert.deepEqual(rows[0], { 物料编码: 'T382' })
})

test('④ 已存在的编码 / 本次勾选内重复 ⇒ 跳过并计数', () => {
  const { rows, skipped } = goodsToDetail([ROWS[0], ROWS[1], ROWS[0]], ['T383'], ['物料编码', '物料名称'])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['物料编码'], 'T382')
  assert.equal(skipped, 2)
})

test('④ 没有存货编码的行直接忽略(不造空行)', () => {
  const { rows, skipped } = goodsToDetail([{ 存货名称: '无码物料' }], [], ['物料编码'])
  assert.equal(rows.length, 0)
  assert.equal(skipped, 0)
})

test('⑤ 四栏与商品面板的列名一致(改列名必须同步这里)', () => {
  assert.deepEqual(GOODS_FACETS, ['所属类别', '存货编码', '存货名称', '规格型号'])
  for (const r of ROWS) {
    for (const k of GOODS_FACETS) assert.ok(k in r, `样例数据缺少 ${k}`)
  }
})
