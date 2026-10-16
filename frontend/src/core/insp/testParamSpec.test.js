import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTestMethod } from './testParamSpec.js'

/**
 * 判据出处:规格书(test 账套 SD-2026-10-0010)实测的**检验方法**原文 ——
 *   强度·*抗压强度 → 「将炭棒水平放置在仪器上,调整间距40mm,设置下压速度5mm/min,按测试键,
 *                    仪器自动下压,断裂后读取压断时最大力压力值」
 *   #*压降        → 「…滤瓶进出水用2分管直接连接,测试用水纯水/超纯水,水温控制25±1℃,
 *                    测试流速0.9L/min,滤前前后接装压力表…」
 * 落点 = 成型工艺清单 抗压强度块的 测试间距mm / 压头下降速度,压降块的 压降测试流速。
 */

test('实测原句:抗压强度的方法里抠出 测试间距40 / 压头下降速度5', () => {
  const s = '将炭棒水平放置在仪器上，调整间距40mm，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值'
  assert.deepEqual(parseTestMethod(s), { 测试间距mm: '40', 压头下降速度: '5' })
})

test('实测原句:压降的方法里抠出 测试流速0.9', () => {
  const s = '将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，测试用水纯水/超纯水，水温控制25±1℃，测试流速0.9L/min，滤前前后接装压力表，压力表距离滤芯接口位置长度50mm，通水10min后记录压差值（滤芯前压-后压）。'
  assert.deepEqual(parseTestMethod(s), { 压降测试流速: '0.9' })
})

test('只认锚点词:「距离…50mm」「通水10min」不许被当成 间距/速度/流速', () => {
  assert.deepEqual(parseTestMethod('压力表距离滤芯接口位置长度50mm，通水10min后记录压差值'), {})
  assert.deepEqual(parseTestMethod('水温控制25±1℃'), {})
})

test('缺项/空串 ⇒ 一个键都不出现(绝不写半截值)', () => {
  assert.deepEqual(parseTestMethod('按测试键读取最大力压力值'), {})
  assert.deepEqual(parseTestMethod(''), {})
  assert.deepEqual(parseTestMethod(null), {})
})

test('全角/空格照样认;带偏差的流速原样带出来', () => {
  assert.deepEqual(parseTestMethod('调整间距　４０ｍｍ'), { 测试间距mm: '40' })
  assert.deepEqual(parseTestMethod('测试流速0.9±0.1L/min'), { 压降测试流速: '0.9±0.1' })
})

test('速度的三种写法都认(下压速度 / 压头下降速度 / 下降速度)', () => {
  assert.equal(parseTestMethod('设置下压速度5mm/min').压头下降速度, '5')
  assert.equal(parseTestMethod('压头下降速度 5 mm/min').压头下降速度, '5')
  assert.equal(parseTestMethod('下降速度5mm/min').压头下降速度, '5')
})
