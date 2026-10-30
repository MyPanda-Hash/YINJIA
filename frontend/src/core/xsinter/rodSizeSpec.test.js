/**
 * rodSizeSpec.test.js —— 规格书「炭棒尺寸」句 → X烧结三格  2026-10-30
 *
 * 口径见 dimensionSpec.js 的 parseRodSizeRequirement 注释：
 *   要长度（计算器必要输入）、不要公差（X烧结公差来自模具表）、输出键是 X烧结的字段名。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRodSizeRequirement, parseDimensionRequirement } from '../insp/dimensionSpec.js'

test('① 标准句式：外径/内径/长度三项全出，公差被丢弃', () => {
  const r = parseRodSizeRequirement('外径 30±0.5mm、内径 12±0.3mm、长度 116±2mm')
  assert.deepEqual(r, { 炭棒外径: '30', 炭棒内径: '12', 炭棒出货长度: '116' })
})

test('② 全角数字/符号同样认（规格书是人工填的）', () => {
  const r = parseRodSizeRequirement('外径　３０±０．５ｍｍ，内径 １２，长度 １１６')
  assert.deepEqual(r, { 炭棒外径: '30', 炭棒内径: '12', 炭棒出货长度: '116' })
})

test('③ 「出货长度」不会被「长度」截半，且优先取整词', () => {
  const r = parseRodSizeRequirement('外径 30 内径 12 出货长度 116')
  assert.equal(r['炭棒出货长度'], '116')
})

test('④ 解析不出的格一个键都不出现（绝不写半截值）', () => {
  assert.deepEqual(parseRodSizeRequirement('外径 30'), { 炭棒外径: '30' })
  assert.deepEqual(parseRodSizeRequirement('外径 ±0.5mm'), {}, '没有名义值 ⇒ 不写')
  assert.deepEqual(parseRodSizeRequirement(''), {})
  assert.deepEqual(parseRodSizeRequirement(null), {})
})

test('⑤ 与成型工艺清单那个解析器互不串味（键名不同、长度归属不同）', () => {
  const text = '外径 30±0.5mm、内径 12±0.3mm、长度 116±2mm'
  const mold = parseDimensionRequirement(text)
  const xs = parseRodSizeRequirement(text)
  // 成型那套：要公差、不要长度，键名带 mm
  assert.deepEqual(mold, { 外径mm: '30', 外径公差: '±0.5', 内径mm: '12', 内径公差: '±0.3' })
  assert.equal(Object.keys(mold).some((k) => k.includes('长度')), false, '成型侧不该出长度')
  // X烧结这套：要长度、不要公差
  assert.deepEqual(xs, { 炭棒外径: '30', 炭棒内径: '12', 炭棒出货长度: '116' })
  assert.equal(Object.keys(xs).some((k) => k.includes('公差')), false, 'X烧结侧不该出公差')
})

test('⑥ 小数尺寸', () => {
  const r = parseRodSizeRequirement('外径 44.5，内径 19.5，长度 120.5')
  assert.deepEqual(r, { 炭棒外径: '44.5', 炭棒内径: '19.5', 炭棒出货长度: '120.5' })
})
