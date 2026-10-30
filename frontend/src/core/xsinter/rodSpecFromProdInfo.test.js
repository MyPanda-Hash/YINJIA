/**
 * rodSpecFromProdInfo.test.js —— 炭棒规格三格的三层兜底  2026-10-30
 *
 * 用真实数据：产品信息表 PI-2026-10-0018
 *   产品整体尺寸 = 外径 33mm ±0.5 / 内径 12mm ±0.3 / 长度 110mm ±0.5
 *   炭棒外径 33 / 炭棒内径 12 / 炭棒长度 = 空
 * 用户报障的现象就是「外径内径出来了，长度空着」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { rodSpecFromProdInfo } from './rodSpecFromProdInfo.js'

const WHOLE = '外径 33mm ±0.5 / 内径 12mm ±0.3 / 长度 110mm ±0.5'

test('① 参照行只有整串（三个独立列全空）⇒ 长度也能从整串解析出来', () => {
  const r = rodSpecFromProdInfo({ 产品整体尺寸: WHOLE })
  assert.deepEqual(r, { 炭棒外径: '33', 炭棒内径: '12', 炭棒出货长度: '110' })
})

test('② 只填了「炭棒尺寸」整串时同样解析（老单据的形态）', () => {
  const r = rodSpecFromProdInfo({ 炭棒尺寸: '外径 30mm 内径 12mm 长度 116mm' })
  assert.deepEqual(r, { 炭棒外径: '30', 炭棒内径: '12', 炭棒出货长度: '116' })
})

test('③ 独立字段优先于整串（真实真源是三个独立列）', () => {
  // 独立列与整串不一致时，以独立列为准
  const r = rodSpecFromProdInfo({ 炭棒外径: '35', 炭棒内径: '13', 炭棒长度: '120', 产品整体尺寸: WHOLE })
  assert.deepEqual(r, { 炭棒外径: '35', 炭棒内径: '13', 炭棒出货长度: '120' })
})

test('④ 参照行里已经叫「炭棒出货长度」的键也认（不同版本列配置）', () => {
  const r = rodSpecFromProdInfo({ 炭棒出货长度: '116' })
  assert.deepEqual(r, { 炭棒出货长度: '116' })
})

test('⑤ 纸上已填的格不覆盖（current 非空就跳过）', () => {
  const r = rodSpecFromProdInfo(
    { 炭棒外径: '33', 炭棒内径: '12', 炭棒长度: '110' },
    { 炭棒外径: '33', 炭棒内径: '', 炭棒出货长度: '99' },
  )
  // 外径已填同值 → 不写；内径空 → 补；长度已有 99 → 不覆盖成 110
  assert.deepEqual(r, { 炭棒内径: '12' })
})

test('⑥ 空 source / 脏数据不返回任何键（不落半截值）', () => {
  assert.deepEqual(rodSpecFromProdInfo(null), {})
  assert.deepEqual(rodSpecFromProdInfo({}), {})
  assert.deepEqual(rodSpecFromProdInfo({ 产品整体尺寸: '外径 33mm' }), { 炭棒外径: '33' })
  assert.deepEqual(rodSpecFromProdInfo({ 炭棒外径: '   ' }), {})
})
