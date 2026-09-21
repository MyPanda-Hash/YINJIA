import test from 'node:test'
import assert from 'node:assert/strict'
import { matchSinterModel, densityOf, specCarryFrom } from './recipeSheet.js'

/**
 * 「按产品规格一键带出」的纯逻辑(2026-09-21)。
 *
 * 场景:同一产品做第二章成型工艺清单时,炭棒规格/烧结尺寸/密度范围都要重敲一遍;
 *   而这三样其实都能从已有数据推出来 ——
 *     · 炭棒规格 1/2/3(外径/内径/长度)← 产品信息表 RD_PROD_INFO(炭棒外径/炭棒内径/炭棒长度);
 *     · 烧结尺寸型号 ← 按外径/内径在烧结尺寸表 rd_sinter_tolerance 里匹配;
 *     · 密度范围 ← **该产品最近一张已保存的成型工艺清单**(不编造:没有历史就明确说没有)。
 * 硬口径:**只填空格,绝不覆盖工艺员已填的值**(覆盖会悄悄改掉人已确认的工艺参数)。
 */

/* ── specCarryFrom:产品信息 + 历史单 → 页1 该补的格 ── */
test('产品信息的炭棒外径/内径/长度 → 炭棒规格1/2/3', () => {
  const r = specCarryFrom(
    { 炭棒外径: '59.5', 炭棒内径: '39.5', 炭棒长度: '120' },
    null,
    {},
  )
  assert.deepEqual(r.patch, { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120' })
  assert.deepEqual(r.skipped, [])
  assert.deepEqual(r.missing, ['密度'])
})

test('已有值不覆盖(skipped 里报出来给提示)', () => {
  const r = specCarryFrom(
    { 炭棒外径: '59.5', 炭棒内径: '39.5', 炭棒长度: '120' },
    { 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' },
    { 炭棒规格1: '60.5' },
  )
  assert.deepEqual(r.patch, { 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' })
  assert.deepEqual(r.skipped, ['炭棒规格1'])
})

test('历史单只填了「密度管控要求」文本 → 解析出上下限再带出', () => {
  const r = specCarryFrom({}, { 密度管控要求: '0.56~0.58' }, {})
  assert.deepEqual(r.patch, { 实际密度管控下限: '0.56', 实际密度管控上限: '0.58' })
})

test('产品信息与历史单都拿不到 → 什么都不补,missing 里如实报出来', () => {
  const r = specCarryFrom(null, null, {})
  assert.deepEqual(r.patch, {})
  assert.deepEqual(r.missing, ['炭棒规格', '密度'])
})

test('产品信息里空串/空白不算值', () => {
  const r = specCarryFrom({ 炭棒外径: '  ', 炭棒内径: '', 炭棒长度: null }, null, {})
  assert.deepEqual(r.patch, {})
  assert.deepEqual(r.missing, ['炭棒规格', '密度'])
})

/* ── densityOf:密度口径唯一出处(带出/历史筛选共用)── */
test('densityOf:上下限齐全直接用', () => {
  assert.deepEqual(densityOf({ 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' }), { low: '0.58', high: '0.60' })
})

test('densityOf:缺上下限时解析「密度管控要求」文本;两样都没有给 null', () => {
  assert.deepEqual(densityOf({ 密度管控要求: '0.56~0.58' }), { low: '0.56', high: '0.58' })
  assert.deepEqual(densityOf({ 实际密度管控下限: '0.58' }), null)
  assert.equal(densityOf(null), null)
})

/* ── matchSinterModel:按外径/内径在尺寸表里找型号 ── */
const ROWS = [
  { 车间: '1', 型号: '60*45（炭棒59.5*44.5）', 炭棒外径: '59.5', 炭棒内径: '44.5' },
  { 车间: '1', 型号: '60*40（炭棒59.5*39.5）', 炭棒外径: '59.5', 炭棒内径: '39.5' },
  { 车间: '2', 型号: '63*40', 炭棒外径: '62.5', 炭棒内径: '39.5' },
  { 车间: '1/3', 型号: '60*40', 炭棒外径: '59.5', 炭棒内径: '39.5' },
]

test('按外径+内径匹配型号(优先单据车间)', () => {
  assert.equal(matchSinterModel(ROWS, '1', 59.5, 39.5), '60*40（炭棒59.5*39.5）')
  assert.equal(matchSinterModel(ROWS, '2', 62.5, 39.5), '63*40')
})

test('单据车间里没有该规格 ⇒ 不跨车间乱选(宁可空着让人手选)', () => {
  // 车间 4 在表里没有行;车间 2 有行但没有 59.5/39.5 这个规格 ⇒ 都返回空,不去别的车间凑
  assert.equal(matchSinterModel(ROWS, '4', 59.5, 39.5), '')
  assert.equal(matchSinterModel(ROWS, '2', 59.5, 39.5), '')
})

test('缺尺寸或没有匹配 → 空串(界面按"没匹配到"提示)', () => {
  assert.equal(matchSinterModel(ROWS, '1', null, 39.5), '')
  assert.equal(matchSinterModel(ROWS, '1', 70, 39.5), '')
  assert.equal(matchSinterModel([], '1', 59.5, 39.5), '')
})

test('车间 1/3 这类写法按 / 拆开也能匹配上', () => {
  assert.equal(matchSinterModel([ROWS[3]], '3', 59.5, 39.5), '60*40')
})
