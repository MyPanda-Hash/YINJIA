// 出货检验计划「默认勾选/带入」纯函数单测(2026-10-30)
// 口径:成品检验 = 外观/尺寸/重量 三类默认勾选,其余默认不勾;
//       制程检验 = 三类默认不勾,其余(性能/功能性…)默认勾选;
//       两个入口(弹窗默认勾选 / 工具栏「取出货检验计划」)共用同一条规则。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { defaultShipRows, shipRowType, shipTypeOfText, sortAsPhysical } from './shipPlanDefaults.js'

/** 计划行夹具:类别(检验内容)可空,值形状与 fromShipPlan 下发一致 */
const row = (item, category = '', extra = {}) => ({ 序号: '1', 检验项目: item, 表区: category, 检验类型: category, ...extra })

test('shipTypeOfText:含外观/尺寸/重量 → 三类;归不上 → 空串', () => {
  assert.equal(shipTypeOfText('外观'), '外观')
  assert.equal(shipTypeOfText('重要尺寸'), '尺寸')
  assert.equal(shipTypeOfText('重量'), '出货重量')
  assert.equal(shipTypeOfText('性能'), '')
  assert.equal(shipTypeOfText(''), '')
  assert.equal(shipTypeOfText(null), '')
})

test('shipRowType:检验内容有值以它为准;为空才回退项目名关键词', () => {
  assert.equal(shipRowType(row('尺寸稳定性', '性能')), '', '类别写着性能 ⇒ 即使项目名带「尺寸」也不归尺寸')
  assert.equal(shipRowType(row('*外观', '外观')), '外观')
  assert.equal(shipRowType(row('*炭棒尺寸', '')), '尺寸', '检验内容空 ⇒ 按项目名兜底(库里现状)')
  assert.equal(shipRowType(row('重量·（干重）', '')), '出货重量')
  assert.equal(shipRowType(row('跌落强度', '')), '')
})

test('defaultShipRows 成品检验:只默认勾选 外观/尺寸/重量,顺序 外观→尺寸→出货重量', () => {
  const rows = [
    row('*外观'),
    row('*炭棒尺寸'),
    row('跌落强度'),
    row('*整体尺寸'),
    row('初始流速'),
    row('*出货重量'),
    row('卫生安全'),
  ]
  const picked = defaultShipRows('QC_ASM_INSP', rows)
  assert.deepEqual(picked.map((r) => r['检验项目']), ['*外观', '*炭棒尺寸', '*整体尺寸', '*出货重量'])
  assert.equal(picked.length, 4)
})

test('defaultShipRows 成品检验:计划里没有重量行时只勾外观+尺寸(不因缺类报错)', () => {
  const rows = [row('*外观'), row('炭棒尺寸（裸棒）'), row('跌落强度'), row('*卫生安全')]
  assert.deepEqual(defaultShipRows('QC_ASM_INSP', rows).map((r) => r['检验项目']), ['*外观', '炭棒尺寸（裸棒）'])
})

test('defaultShipRows 制程检验:三类默认不勾,其余默认勾选(保持计划原序)', () => {
  const rows = [
    row('*外观'),
    row('*炭棒尺寸'),
    row('跌落强度'),
    row('*出货重量'),
    row('初始流速及压降测试·*压降'),
    row('*卫生安全'),
  ]
  assert.deepEqual(defaultShipRows('QC_PROC_INSP', rows).map((r) => r['检验项目']), ['跌落强度', '初始流速及压降测试·*压降', '*卫生安全'])
})

test('defaultShipRows 其它面板/空数据:原样(不参与该规则的来源保持全量口径)', () => {
  const rows = [row('*外观'), row('跌落强度')]
  assert.deepEqual(defaultShipRows('QC_FIRST_INSP', rows).map((r) => r['检验项目']), ['*外观', '跌落强度'])
  assert.deepEqual(defaultShipRows('QC_ASM_INSP', []), [])
  assert.deepEqual(defaultShipRows('QC_ASM_INSP', null), [])
})

test('sortAsPhysical:外观→尺寸→出货重量,同类内保持原序', () => {
  const rows = [row('*出货重量'), row('内径尺寸'), row('*外观'), row('外径尺寸')]
  assert.deepEqual(sortAsPhysical(rows).map((r) => r['检验项目']), ['*外观', '内径尺寸', '外径尺寸', '*出货重量'])
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
