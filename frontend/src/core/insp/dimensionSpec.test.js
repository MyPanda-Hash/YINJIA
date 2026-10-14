/**
 * dimensionSpec 单测:规格书「检验项目=尺寸」的整句「检验要求」→ 成型工艺清单四格。
 *
 * 用户口径(2026-10-15):「如果是尺寸,应该是把对应检测的内径或者外径的公差等数据
 * 填写进成型工艺清单的对应检测要求里面的数据表格里面」。
 *
 * 钉住的不变量(改实现时这些断言必须拦得住):
 *   ① 四格的取值与「公差带符号」;
 *   ② **解析不出来的格不出现**(不给半截值、不写空串)—— 调用方据此"保持不动";
 *   ③ **长度不解析**(本面板没有对应的数据格,那几个是脱模的长度范围三项);
 *   ④ 全角/半角、冒号、换行、缺项都要认。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDimensionRequirement } from './dimensionSpec.js'

test('实测句式:外径/内径 各带公差 ⇒ 四格齐全,公差原样带符号', () => {
  assert.deepEqual(
    parseDimensionRequirement('外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm'),
    { 外径mm: '20', 外径公差: '±0.5', 内径mm: '5', 内径公差: '±0.3' },
  )
})

test('长度项一律不落格(本面板没有「长度」数据格,不硬塞进范围三项)', () => {
  const out = parseDimensionRequirement('外径 20±0.5mm、内径 5±0.3mm、长度 250±2mm')
  assert.deepEqual(Object.keys(out).sort(), ['外径公差', '外径mm', '内径公差', '内径mm'].sort())
  assert.deepEqual(parseDimensionRequirement('长度 250±2mm'), {}, '只有长度 ⇒ 一格都不写')
})

test('只有外径(缺内径项)⇒ 只写外径两格,不补空的内径格', () => {
  assert.deepEqual(parseDimensionRequirement('外径 20±0.5mm'),
    { 外径mm: '20', 外径公差: '±0.5' })
})

test('有名义值没公差 ⇒ 只写名义值格,不写公差格', () => {
  assert.deepEqual(parseDimensionRequirement('内径 5mm'), { 内径mm: '5' })
})

test('全角数字/字母/符号/全角空格同样认(折成半角后同解)', () => {
  assert.deepEqual(
    parseDimensionRequirement('外径２０±０．５ｍｍ、内径５±０．３ｍｍ'),
    { 外径mm: '20', 外径公差: '±0.5', 内径mm: '5', 内径公差: '±0.3' },
  )
  assert.deepEqual(parseDimensionRequirement('外径\u300020\u3000±\u30000.5'), { 外径mm: '20', 外径公差: '±0.5' })
})

test('写法差异都认:半角冒号/全角冒号/换行/顺序颠倒/空格', () => {
  assert.deepEqual(parseDimensionRequirement('内径:5±0.3mm\n外径：20±0.5 mm'),
    { 外径mm: '20', 外径公差: '±0.5', 内径mm: '5', 内径公差: '±0.3' })
  assert.deepEqual(parseDimensionRequirement('外径20±0.5'), { 外径mm: '20', 外径公差: '±0.5' })
})

test('公差写了 +- / +/- 也认(符号原样带出)', () => {
  assert.deepEqual(parseDimensionRequirement('外径 20+-0.5mm'), { 外径mm: '20', 外径公差: '+-0.5' })
  assert.deepEqual(parseDimensionRequirement('内径 5+/-0.3mm'), { 内径mm: '5', 内径公差: '+/-0.3' })
})

test('没有名义值(只有公差)⇒ 一格都不写,不许只写半截', () => {
  assert.deepEqual(parseDimensionRequirement('外径 ±0.5mm'), {})
})

test('解析不出来的句子 ⇒ 空对象(调用方据此保持那一格不动)', () => {
  assert.deepEqual(parseDimensionRequirement('无'), {})
  assert.deepEqual(parseDimensionRequirement('符合图纸要求'), {})
  assert.deepEqual(parseDimensionRequirement(''), {})
  assert.deepEqual(parseDimensionRequirement('   '), {})
  assert.deepEqual(parseDimensionRequirement(null), {})
  assert.deepEqual(parseDimensionRequirement(undefined), {})
  assert.deepEqual(parseDimensionRequirement(123), {})
})

test('小数名义值/三位小数公差都抠得干净', () => {
  assert.deepEqual(parseDimensionRequirement('外径 20.5±0.05mm'), { 外径mm: '20.5', 外径公差: '±0.05' })
})
