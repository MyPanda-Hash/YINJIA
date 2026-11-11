import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceHintOf } from './sourceHint.js'

/**
 * 采购入库单表头「来源」提示(2026-11-11 用户口径第二版:「不要做成字段,做成个按钮或者是提示就行」)。
 * 这里钉的是**提示的取值与可点判定**:
 *   · 三来源链路(暂收 / 检验 / 特采)带得出类型 + 单号;
 *   · 手工新增 / 金蝶导入的老单(两列都空)不显示提示 —— 不能出一个空壳提示;
 *   · 只有单号没有类型时不乱猜,照样显示但不可点。
 * (面板名 → 面板编码的反查在 ./panelCodeByName.js,依赖菜单树,界面里另测。)
 */

const fakePanels = { 送料暂收单: 'QC_RECV', 来料检验单: 'QC_INSP', 特采单: 'QC_TC_IN' }
const resolve = (name) => fakePanels[String(name || '').trim()] || ''

test('检验入库的单据:类型 + 单号 + 可点', () => {
  const hint = sourceHintOf({ 来源: '来料检验单', 来源单号: 'IJ-2026-10-0064' }, resolve)
  assert.deepEqual(hint, { type: '来料检验单', docNo: 'IJ-2026-10-0064', panelCode: 'QC_INSP', canOpen: true })
})

test('暂收直达与特采入库同样可点(三来源都要能跳)', () => {
  assert.equal(sourceHintOf({ 来源: '送料暂收单', 来源单号: 'SL-2026-10-0119' }, resolve).panelCode, 'QC_RECV')
  assert.equal(sourceHintOf({ 来源: '特采单', 来源单号: 'TC-2026-10-0012' }, resolve).panelCode, 'QC_TC_IN')
})

test('两列都空 ⇒ 不显示提示(手工新增 / 金蝶导入老单)', () => {
  assert.equal(sourceHintOf({}, resolve), null)
  assert.equal(sourceHintOf(null, resolve), null)
  assert.equal(sourceHintOf({ 来源: '', 来源单号: '   ' }, resolve), null)
})

test('两侧空格不影响取值', () => {
  const hint = sourceHintOf({ 来源: '  来料检验单 ', 来源单号: ' IJ-1 ' }, resolve)
  assert.deepEqual(hint, { type: '来料检验单', docNo: 'IJ-1', panelCode: 'QC_INSP', canOpen: true })
})

test('只有单号没有类型 ⇒ 照实显示、但不猜面板(不可点)', () => {
  const hint = sourceHintOf({ 来源单号: 'SL-2026-10-0119' }, resolve)
  assert.deepEqual(hint, { type: '', docNo: 'SL-2026-10-0119', panelCode: '', canOpen: false })
})

test('类型反查不到面板 ⇒ 显示、不可点(不报错)', () => {
  const hint = sourceHintOf({ 来源: '某张下架单据', 来源单号: 'X-1' }, resolve)
  assert.equal(hint.panelCode, '')
  assert.equal(hint.canOpen, false)
})

test('不给反查函数也不炸(默认不可点)', () => {
  const hint = sourceHintOf({ 来源: '来料检验单', 来源单号: 'IJ-1' })
  assert.equal(hint.panelCode, '')
  assert.equal(hint.canOpen, false)
})
