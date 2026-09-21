import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SLOT_GROUPS, groupOfMaterialType, parseRatio, parseDensityRange, moisturePercent,
  slotsFromRows, paramsFromHead, buildPatch,
} from './recipeSheet.js'
import { compute } from './recipeEngine.js'

/**
 * 弹窗侧纯逻辑:单据页 2「配方表」的行 ⇄ 引擎的 10 料位、单据头字段 → 引擎入参、引擎结果 → 回填补丁。
 * 这三段都必须是纯函数(可测),弹窗只负责把它们接起来 —— 否则"算错了"永远只能靠肉眼在界面上看。
 */

/** 造一行配方表(照单据里真实的数据键) */
const row = (kind, code, design) => ({ 表区: '配方表', 序号: '', 物料种类: kind, 物料编号: code, 物料名称: code, 设计添加量: design })

/** 记 14(exe 2026-09-17 算过的真实单)的配方:粉料 0.62 / 胶粉 0.33+0.05 / 折算料 0 */
const rows14 = [
  row('炭粉', 'YJ-XH-001', '0.62'),
  row('炭粉', 'YJ-XH-001', '0'),
  row('炭粉', 'YJ-XH-001', '0'),
  row('炭粉', 'YJ-XH-001', '0'),
  row('炭粉', 'YJ-XH-001', '0'),
  row('胶粉', 'YJ-ZX-003', '0.33'),
  row('胶粉', 'YJ-SLD-009', '0.05'),
  row('功能料-颗粒', '颗粒料-A', ''),
  row('功能料-颗粒', '颗粒料-A', ''),
  row('功能料-颗粒', '颗粒料-A', ''),
]

test('物料种类 → 料位分组:炭粉/功能料-粉末=粉料、胶粉=胶粉、功能料-颗粒=折算料', () => {
  assert.equal(SLOT_GROUPS.POWDER, '粉料')
  assert.equal(SLOT_GROUPS.GLUE, '胶粉')
  assert.equal(SLOT_GROUPS.CONVERTED, '折算料')
  assert.equal(groupOfMaterialType('炭粉'), '粉料')
  assert.equal(groupOfMaterialType('功能料-粉末'), '粉料')
  assert.equal(groupOfMaterialType('胶粉'), '胶粉')
  assert.equal(groupOfMaterialType('功能料-颗粒'), '折算料')
  assert.equal(groupOfMaterialType('折算物料'), '折算料')
  assert.equal(groupOfMaterialType(''), '')
  assert.equal(groupOfMaterialType(undefined), '')
})

test('设计添加量:小数直接当比例,"62"/"62%" 按百分数解释并标记', () => {
  assert.deepEqual(parseRatio('0.62'), { value: 0.62, percentAssumed: false })
  assert.deepEqual(parseRatio('0.62'), { value: 0.62, percentAssumed: false })
  assert.deepEqual(parseRatio('62'), { value: 0.62, percentAssumed: true })
  assert.deepEqual(parseRatio('62%'), { value: 0.62, percentAssumed: false })
  assert.deepEqual(parseRatio('1'), { value: 1, percentAssumed: false })
  assert.deepEqual(parseRatio('0'), { value: 0, percentAssumed: false })
  assert.equal(parseRatio(''), null)
  assert.equal(parseRatio(null), null)
  assert.equal(parseRatio('abc'), null)
})

test('含水率输入是百分数:弹窗里填 6 表示 6%,交给引擎的必须是 0.06', () => {
  // 弹窗那一格标签是「含水率%」(与 exe 前端一致:它把物料的 0.06 显示成 6.0),
  // 而引擎的 moisture 是小数 —— 少这一步换算,填 6 会被当成 600%,灌料湿重直接算飞。
  assert.equal(moisturePercent('6'), 0.06)
  assert.equal(moisturePercent('6.5'), 0.065)
  assert.equal(moisturePercent('0.06'), 0.0006)   // 照百分数解释:0.06% 就是 0.0006
  assert.equal(moisturePercent('0'), 0)
  assert.equal(moisturePercent(''), null)
  assert.equal(moisturePercent(null), null)
  assert.equal(moisturePercent('abc'), null)
})

test('密度范围文本可解析:密度范围：0.56~0.58', () => {
  assert.deepEqual(parseDensityRange('密度范围：0.56~0.58'), [0.56, 0.58])
  assert.deepEqual(parseDensityRange('0.56-0.58'), [0.56, 0.58])
  assert.deepEqual(parseDensityRange('0.56～0.58'), [0.56, 0.58])
  assert.equal(parseDensityRange(''), null)
  assert.equal(parseDensityRange('密度范围：~'), null)
})

test('配方表 → 10 料位:分组占位、料位1 是补差位(= 1 − Σ料位2~7)', () => {
  const { slots, warnings } = slotsFromRows(rows14)
  assert.equal(slots.length, 10)
  assert.deepEqual(slots.map((s) => s.group), ['粉料', '粉料', '粉料', '粉料', '粉料', '胶粉', '胶粉', '折算料', '折算料', '折算料'])
  assert.deepEqual(slots.map((s) => s.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  // 料位1 补差:1 − (0+0+0+0 + 0.33 + 0.05) = 0.62,与单据上填的值一致
  assert.equal(slots[0].designRatio, 1 - (0.33 + 0.05))
  assert.equal(slots[0].derived, true)
  assert.equal(slots[5].designRatio, 0.33)
  assert.equal(slots[6].designRatio, 0.05)
  assert.deepEqual(warnings, [])
})

test('折算料行按"克/支"读,不折算成比例', () => {
  const { slots } = slotsFromRows([
    row('炭粉', 'A', '0.5'), row('炭粉', 'A', ''), row('炭粉', 'A', ''), row('炭粉', 'A', ''), row('炭粉', 'A', ''),
    row('胶粉', 'B', '0.5'), row('胶粉', 'B', ''),
    row('功能料-颗粒', 'C', '2.5'), row('功能料-颗粒', 'C', '1'), row('功能料-颗粒', 'C', ''),
  ])
  assert.equal(slots[7].amountG, 2.5)
  assert.equal(slots[8].amountG, 1)
  assert.equal(slots[9].amountG, 0)
  assert.equal(slots[7].designRatio, null)
})

test('分组超容量:第 6 个粉料行被忽略并告警(不静默算错)', () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row('炭粉', 'P' + i, '0.1')),
    row('胶粉', 'G', '0.4'),
  ]
  const { slots, warnings } = slotsFromRows(rows)
  assert.equal(slots.filter((s) => s.group === '粉料').length, 5)
  assert.equal(slots[0].rowIndex, 0)
  assert.equal(slots[4].rowIndex, 4)
  assert.ok(warnings.some((w) => w.includes('粉料') && w.includes('最多')), warnings.join('|'))
})

test('物料种类认不出来时按粉料占位并告警', () => {
  const { slots, warnings } = slotsFromRows([row('莫名其妙', 'X', '1'), row('胶粉', 'G', '0')])
  assert.equal(slots[0].group, '粉料')
  assert.ok(warnings.some((w) => w.includes('莫名其妙')), warnings.join('|'))
})

test('行数不足 10 时补空料位(折叠料位不参与计算)', () => {
  const { slots } = slotsFromRows([row('炭粉', 'A', '1'), row('胶粉', 'B', '0')])
  assert.equal(slots.length, 10)
  assert.equal(slots[2].code, '')
  assert.equal(slots[2].designRatio, null)
  assert.equal(slots[9].group, '折算料')
})

test('折算料行不该报"按百分数解释"的假告警(它的设计值本来就是克/支,>1 很正常)', () => {
  // 界面探针实测到过这条假告警:「料位 8 的『设计添加量』填的是 2,已按百分数解释为 2.00%」——
  // 数值本身没错(折算料就是按 2 克/支算的),但这条提示会让工艺员去改一个本来就对的格。
  const { slots, warnings } = slotsFromRows([
    row('炭粉', 'A', '1'), row('炭粉', 'A', ''), row('炭粉', 'A', ''), row('炭粉', 'A', ''), row('炭粉', 'A', ''),
    row('胶粉', 'B', '0'), row('胶粉', 'B', ''),
    row('功能料-颗粒', 'C', '2'), row('功能料-颗粒', 'C', '10'), row('功能料-颗粒', 'C', ''),
  ])
  assert.equal(slots[7].amountG, 2)
  assert.equal(slots[8].amountG, 10)
  assert.deepEqual(warnings, [])
})

test('已知局限:把「功能料-粉末」的物料填进折算料位会被分到粉料位(超容量即告警,不会静默算错)', () => {
  // 这不是假设:exe 的历史记录里就出现过「功能料-粉末」的物料坐在折算料位(料位由**位置**决定,
  // 不由物料种类决定)。单据的配方表没有料位号列,只能按物料种类分组,故这种填法会被分错 ——
  // 这里把行为钉死:粉料超容量时**明确告警**,而不是悄悄少算一行。
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => row('炭粉', 'P' + i, '0.2')),
    row('胶粉', 'G', '0'),
    row('功能料-粉末', 'YJ-HKB-001', '2'),
  ]
  const { slots, warnings } = slotsFromRows(rows)
  assert.ok(warnings.some((w) => w.includes('粉料料位最多 5 个')), warnings.join('|'))
  assert.equal(slots[7].rowIndex, -1)
  assert.equal(slots[7].amountG, 0)
})

test('单据头 → 引擎入参:尺寸取炭棒规格 1/2/3,密度取实际管控上下限', () => {
  const { params, missing } = paramsFromHead(
    { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' },
    { cavities: 2, conversion_ratio: 0.5 })
  assert.deepEqual(missing, [])
  assert.equal(params.od, 59.5)
  assert.equal(params.id, 39.5)
  assert.equal(params.length, 120)
  assert.equal(params.density_low, 0.58)
  assert.equal(params.density_high, 0.6)
  assert.equal(params.cavities, 2)
  assert.equal(params.conversion_ratio, 0.5)
  assert.equal(params.length_tol_low, 2.5)
  assert.equal(params.demold_low_factor, 1)
})

test('密度上下限为空时回退解析「密度管控要求」文本,仍缺则记入 missing', () => {
  const back = paramsFromHead({ 炭棒规格1: '45', 炭棒规格2: '30', 炭棒规格3: '200', 密度管控要求: '密度范围：0.56~0.58' },
    { cavities: 1, conversion_ratio: 0.5 })
  assert.equal(back.params.density_low, 0.56)
  assert.equal(back.params.density_high, 0.58)
  const empty = paramsFromHead({}, { cavities: 1, conversion_ratio: 0.5 })
  assert.deepEqual(empty.missing, ['外径', '内径', '长度', '密度下限', '密度上限'])
})

test('尺寸回退:炭棒规格空时用检验要求的 外径mm/内径mm', () => {
  const { params } = paramsFromHead(
    { 外径mm: '45', 内径mm: '30', 炭棒规格3: '200', 实际密度管控下限: '1.2', 实际密度管控上限: '1.4' },
    { cavities: 1, conversion_ratio: 0.5 })
  assert.equal(params.od, 45)
  assert.equal(params.id, 30)
  assert.equal(params.length, 200)
})

test('引擎结果 → 回填补丁:页 1 十一个格 + 配方表两列,位数与百分号照设计文档', () => {
  const { slots } = slotsFromRows(rows14)
  slots.forEach((s) => { s.moisture = s.group === '折算料' ? 0.08 : 0.06 })
  const { params } = paramsFromHead(
    { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' },
    { cavities: 2, conversion_ratio: 0.5 })
  const result = compute(params, slots.map((s) => ({ design_ratio: s.designRatio, amount_g: s.amountG, moisture: s.moisture })))
  const patch = buildPatch(result, slots)

  // 这些期望值来自 exe 当年算的同一条记录(calc_history #14),不是照实现反填的
  assert.deepEqual(patch.head, {
    理论最低灌料重量g: '242.0',
    理论灌料中间值g: '243.8',
    理论最高灌料重量g: '245.5',
    理论水分: '3.72',
    最短长度mm: '253.5',
    中间值mm: '256.0',
    最长长度mm: '258.5',
    最低重量g: '233.0',
    中间值g: '234.7',
    最高重量g: '236.4',
    实际密度管控下限: '0.58',
    实际密度管控上限: '0.60',
  })
  assert.equal(patch.rows.length, 10)
  assert.deepEqual(patch.rows[0], { rowIndex: 0, code: 'YJ-XH-001', 实际添加比例: '62.00%', 单支物料含量: '145.55' })
  assert.equal(patch.rows[5].实际添加比例, '33.00%')
  assert.equal(patch.rows[5].单支物料含量, '77.47')
  assert.equal(patch.rows[6].实际添加比例, '5.00%')
  assert.equal(patch.rows[6].单支物料含量, '11.74')
})

test('回填补丁只针对有行或有值的料位,空料位不产生行补丁', () => {
  const { slots } = slotsFromRows([row('炭粉', 'A', '1'), row('胶粉', 'B', '0')])
  const result = compute(
    { od: 45, id: 30, length: 200, cavities: 1, density_low: 1.2, density_high: 1.4, conversion_ratio: 0.5 },
    slots.map((s) => ({ design_ratio: s.designRatio, amount_g: s.amountG, moisture: 0.05 })))
  const patch = buildPatch(result, slots)
  assert.deepEqual(patch.rows.map((r) => r.rowIndex), [0, 1])
})
