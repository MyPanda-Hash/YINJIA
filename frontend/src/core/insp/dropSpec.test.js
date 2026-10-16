import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDropRequirement } from './dropSpec.js'

/**
 * 判据出处:规格书(test 账套 SD-2026-10-0010)实测那一行 ——
 *   检验项目 = `强度·（裸棒）`
 *   检验要求 = `成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂`
 * 落点 = 成型工艺清单 跌落强度块三格(高度cm / 跌落次数 / 要求)。
 */

test('实测原句:原话进「跌落要求」,并抠出 高度60cm / 跌落3次', () => {
  assert.deepEqual(
    parseDropRequirement('成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂'),
    { 跌落要求: '成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂', 跌落高度cm: '60', 跌落次数: '3' },
  )
})

test('另一种句式:成型强度：高度50cm,跌3次无断裂', () => {
  assert.deepEqual(parseDropRequirement('成型强度：高度50cm,跌3次无断裂'),
    { 跌落要求: '成型强度：高度50cm,跌3次无断裂', 跌落高度cm: '50', 跌落次数: '3' })
})

test('全角/空格照样认(检验要求是人工填的)', () => {
  assert.deepEqual(parseDropRequirement('高度　６０ｃｍ，垂直跌落 ３ 次'),
    { 跌落要求: '高度　６０ｃｍ，垂直跌落 ３ 次', 跌落高度cm: '60', 跌落次数: '3' })
})

test('抠不出来就不写那一格(绝不写半截值/空串)', () => {
  assert.deepEqual(parseDropRequirement('符合图纸要求，无断裂'), { 跌落要求: '符合图纸要求，无断裂' })
  assert.deepEqual(parseDropRequirement('1.2m 高度自由跌落无破损'), { 跌落要求: '1.2m 高度自由跌落无破损' },
    '单位是 m 不给数 —— 换算成 120cm 是猜,宁可留给人工')
  assert.deepEqual(parseDropRequirement('   '), {})
  assert.deepEqual(parseDropRequirement(null), {})
})

test('不会把「3次」当成高度(两个数字挨着时按关键词分别取)', () => {
  const out = parseDropRequirement('垂直跌落3次')
  assert.equal(out['跌落高度cm'], undefined)
  assert.equal(out['跌落次数'], '3')
})
