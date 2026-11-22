// 出货检验计划「默认勾选/带入」纯函数单测
// 口径(2026-11-22 用户口径,取代 2026-10-30 的「外观/尺寸/重量 三类」):
//   出货检验（表观）QC_ASM_INSP = 检查频率含「1%」的行;
//   出货检验（功能）QC_PROC_INSP = 检查频率含「1PCS」的行;
//   两类都不命中(型式检验/空频率)两边都不默认带。
// 两个入口(弹窗默认勾选 / 工具栏「取出货检验计划」)共用同一条规则。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  defaultShipRows, shipRowType, shipTypeOfText, shipFreqOf, isAppearanceRow, isFunctionalRow,
} from './shipPlanDefaults.js'

/** 计划行夹具:值形状与 fromShipPlan 下发一致(检查频率 ← 检测频率) */
const row = (item, freq = '', category = '') => ({
  序号: '1', 检验项目: item, 表区: category, 检验类型: category, 检查频率: freq,
})

test('shipFreqOf:取「检查频率」,兼容老形状「检测频率」,两边都空 → 空串', () => {
  assert.equal(shipFreqOf({ 检查频率: ' 1%/一个生产批次 ' }), '1%/一个生产批次')
  assert.equal(shipFreqOf({ 检测频率: '1PCS/一个生产批次' }), '1PCS/一个生产批次')
  assert.equal(shipFreqOf({}), '')
  assert.equal(shipFreqOf(null), '')
})

test('表观口径 = 频率含「1%」(兼容历史 生产量*1%)', () => {
  assert.equal(isAppearanceRow(row('*外观', '1%/一个生产批次')), true)
  assert.equal(isAppearanceRow(row('*炭棒尺寸', '生产量*1%')), true, '历史单据写法也算')
  assert.equal(isAppearanceRow(row('*压降测试', '1PCS/一个生产批次')), false)
  assert.equal(isAppearanceRow(row('*卫生安全', '型式检验半年一次')), false)
  assert.equal(isAppearanceRow(row('*外观', '')), false)
})

test('功能口径 = 频率含「1PCS」(大小写不敏感)', () => {
  assert.equal(isFunctionalRow(row('*压降测试', '1PCS/一个生产批次')), true)
  assert.equal(isFunctionalRow(row('*抗压强度', '1pcs/一个工单')), true, '手输小写也认')
  assert.equal(isFunctionalRow(row('*外观', '1%/一个生产批次')), false)
  assert.equal(isFunctionalRow(row('*卫生安全', '型式检验')), false)
})

test('defaultShipRows 表观:只勾 1% 的行,保持计划原序(不再按外观/尺寸/重量重排)', () => {
  const rows = [
    row('*出货重量', '1%/一个生产批次'),
    row('*压降测试', '1PCS/一个生产批次'),
    row('*外观', '1%/一个生产批次'),
    row('*整体尺寸', '1%/一个生产批次'),
    row('*卫生安全', '型式检验'),
  ]
  assert.deepEqual(
    defaultShipRows('QC_ASM_INSP', rows).map((r) => r['检验项目']),
    ['*出货重量', '*外观', '*整体尺寸'],
  )
})

test('defaultShipRows 功能:只勾 1PCS 的行,型式检验两边都不带', () => {
  const rows = [
    row('*外观', '1%/一个生产批次'),
    row('*压降测试', '1PCS/一个生产批次'),
    row('*抗压强度（裸棒）', '1PCS/一个生产批次'),
    row('*卫生安全', '型式检验'),
  ]
  assert.deepEqual(
    defaultShipRows('QC_PROC_INSP', rows).map((r) => r['检验项目']),
    ['*压降测试', '*抗压强度（裸棒）'],
  )
})

test('defaultShipRows 其它面板/空数据:原样(不参与该规则的来源保持全量口径)', () => {
  const rows = [row('*外观', '1%/一个生产批次'), row('*压降测试', '1PCS/一个生产批次')]
  assert.deepEqual(defaultShipRows('QC_FIRST_INSP', rows).map((r) => r['检验项目']), ['*外观', '*压降测试'])
  assert.deepEqual(defaultShipRows('QC_ASM_INSP', []), [])
  assert.deepEqual(defaultShipRows('QC_ASM_INSP', null), [])
})

test('shipRowType/shipTypeOfText:仅用于显示分组(不参与取数)', () => {
  assert.equal(shipTypeOfText('外观'), '外观')
  assert.equal(shipTypeOfText('重要尺寸'), '尺寸')
  assert.equal(shipTypeOfText('重量'), '出货重量')
  assert.equal(shipTypeOfText('性能'), '')
  assert.equal(shipRowType(row('尺寸稳定性', '', '性能')), '', '类别写着性能 ⇒ 即使项目名带「尺寸」也不归尺寸')
  assert.equal(shipRowType(row('*外观')), '外观')
  assert.equal(shipRowType(row('*炭棒尺寸')), '尺寸', '检验内容空 ⇒ 按项目名兜底(库里现状)')
  assert.equal(shipRowType(row('重量·（干重）')), '出货重量')
  assert.equal(shipRowType(row('跌落强度')), '')
})

test('接线:弹窗与工具栏都用这份规则(防两处各写一套后分叉)', () => {
  const dialog = fs.readFileSync(new URL('./QcInspPlanDialog.vue', import.meta.url), 'utf8')
  assert.match(dialog, /import \{ defaultShipRows, shipRowType \} from '\.\/shipPlanDefaults\.js'/, '弹窗要 import 默认勾选规则')
  assert.match(dialog, /defaultShipRows\(props\.panelCode, rows\)/, '弹窗按本面板算默认勾选行')
  assert.match(dialog, /toggleRowSelection\(r, true\)/, '弹窗要把默认行打勾')
  assert.match(dialog, /检验内容: r\['表区'\] \|\| shipRowType\(r\) \|\| ''/, '带入时「检验内容」空 ⇒ 用项目名回退判类')
  const panelx = fs.readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')
  assert.match(panelx, /import \{ defaultShipRows, shipRowType \} from '@core\/qc\/shipPlanDefaults'/, '工具栏要 import 同一规则')
  assert.match(panelx, /defaultShipRows\(panelCode\.value, planRows\)/, '「取出货检验计划」按默认勾选行带入')
  assert.match(panelx, /normInspType\(it\['检验类型'\] \|\| it\['表区'\] \|\| shipRowType\(it\)\)/, '工具栏带入也要按项目名回退判类')
})
