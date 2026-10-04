import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  colsOfTab,
  extFieldsOfTab,
  extFieldInTab,
  EXT_KEY_COL,
  CUSTOM_TAB_KEY,
  DEFAULT_EXT_COL_W,
} from './qcInspReqCols.js'
import { qcInspReqTabs } from '../views/qcInspReqConfig.js'

const TAB = (key) => qcInspReqTabs.find((t) => t.key === key)
/** 三张表各自的自定义列:折叠棉 → 炭棒直径;垫片 → 外观;自定义表 → 平整度 */
const EXT = [
  { id: 1, label: '炭棒直径', col: '备用1', tab: '折叠棉' },
  { id: 2, label: '外观', col: '备用2', tab: '垫片' },
  { id: 3, label: '平整度', col: '备用3', tab: CUSTOM_TAB_KEY },
]

test('归属判据:按 tab 认页签;未标注归属的老数据归「自定义检验要求」(改动前行为)', () => {
  assert.equal(extFieldInTab({ label: 'x', tab: '折叠棉' }, '折叠棉'), true)
  assert.equal(extFieldInTab({ label: 'x', tab: '折叠棉' }, '垫片'), false)
  assert.equal(extFieldInTab({ label: 'x' }, CUSTOM_TAB_KEY), true, '没有 tab → 自定义表')
  assert.equal(extFieldInTab({ label: 'x', tab: ' 折叠棉 ' }, '折叠棉'), true, '两侧 trim')
  assert.deepEqual(extFieldsOfTab(EXT, '折叠棉').map((f) => f.label), ['炭棒直径'])
})

test('固定表:Excel 原列序在前,该表的自定义列追加在后', () => {
  const cols = colsOfTab(TAB('折叠棉'), EXT)
  assert.deepEqual(cols.slice(0, 6).map((c) => c.key),
    ['物料编号', '折叠棉', '炭棒', '实配炭棒后外径', '折数', '折高'], '固定列保持原序')
  assert.deepEqual(cols.slice(6).map((c) => c.key), ['炭棒直径'], '自定义列在最后')
  // 别的表的自定义列不许串进来
  assert.ok(!cols.some((c) => c.key === '外观' || c.key === '平整度'))
})

test('每张表各有各的自定义列(用户口径:单独针对每个表)', () => {
  assert.deepEqual(colsOfTab(TAB('垫片'), EXT).filter((c) => c.key === '外观').length, 1)
  assert.deepEqual(colsOfTab(TAB('折叠棉'), EXT).filter((c) => c.key === '外观').length, 0)
  assert.deepEqual(colsOfTab(TAB('无纺布'), EXT).map((c) => c.key), TAB('无纺布').cols.map((c) => c.key),
    '没加自定义列的表保持原样')
})

test('全自定义表:匹配键 物料编号 在最左 + 本表的自定义列', () => {
  const cols = colsOfTab(TAB(CUSTOM_TAB_KEY), EXT)
  assert.equal(cols[0].key, EXT_KEY_COL.key, '物料编号是最左的匹配键列')
  assert.deepEqual(cols.map((c) => c.key), ['物料编号', '平整度'])
})

test('列宽:自定义列走 widthOf 回调(缺省默认宽)', () => {
  const cols = colsOfTab(TAB('折叠棉'), EXT, (label) => (label === '炭棒直径' ? 200 : 0))
  assert.equal(cols[cols.length - 1].w, 200, 'widthOf 给的宽生效')
  const cols2 = colsOfTab(TAB('折叠棉'), EXT, () => 0)
  assert.equal(cols2[cols2.length - 1].w, DEFAULT_EXT_COL_W, '给 0 → 回落默认宽')
  assert.equal(colsOfTab(TAB('折叠棉'), EXT).length, 7, '不传 widthOf 也能算列')
})

test('没有动态字段 / 空页签:不报错', () => {
  assert.deepEqual(colsOfTab(TAB('折叠棉'), []).map((c) => c.key), TAB('折叠棉').cols.map((c) => c.key))
  assert.deepEqual(colsOfTab(null, EXT), [])
  assert.deepEqual(colsOfTab(TAB(CUSTOM_TAB_KEY), null).map((c) => c.key), ['物料编号'])
})

/** 源码级回归:渲染与带入必须同源(否则"界面看得到、报告带不进来") */
test('页面接线:检验要求表与带入都走 qcInspReqCols', () => {
  const sheet = readFileSync(new URL('../views/QcInspReqSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /@core\/qc\/qcInspReqCols/, 'QcInspReqSheet 必须用共享列判据')
  assert.match(sheet, /colsOfTab\(/, '列由 colsOfTab 算')
  const carry = readFileSync(new URL('./qcInspReqCarry.js', import.meta.url), 'utf8')
  assert.match(carry, /colsOfTab\(/, '带入同样按 colsOfTab 的列(含每表自定义列)')
})
