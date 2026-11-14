import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  colsOfTab,
  extFieldsOfTab,
  extFieldInTab,
  parentOptionsOfTab,
  EXT_KEY_COL,
  DEFAULT_EXT_COL_W,
  LEAD_COLS,
} from './qcInspReqCols.js'
import { qcInspReqTabs, tabsOfPanel, QC_INSP_REQ_SERIES_PANEL } from '../views/qcInspReqConfig.js'

const TAB = (key) => qcInspReqTabs.find((t) => t.key === key)
/** 系列面板(10 张全自定义表)的页签:由物料类别词典决定 —— 这里模拟接口下发的 3 张 */
const SERIES_TABS = tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, ['阻垢系列', 'BK材料系列', '炭粉'])
const TAB_S = (key) => SERIES_TABS.find((t) => t.key === key)
/** 2026-11-11 起:固定表也只剩三个前置列,其余列全来自「父目录 + 两个子目录」的自定义字段 */
const LEAD_KEYS = ['物料编号', '文件编码', '检验依据']
const EXT = [
  { id: 1, label: '检验方法', col: '备用1', tab: '折叠棉', parent: '颗粒安全' },
  { id: 2, label: '检验标准', col: '备用2', tab: '折叠棉', parent: '颗粒安全' },
  { id: 3, label: '平整度', col: '备用141', tab: '阻垢系列' },
]

test('归属判据:严格按 tab 认页签(没标 tab 的不属于任何页签)', () => {
  assert.equal(extFieldInTab({ label: 'x', tab: '折叠棉' }, '折叠棉'), true)
  assert.equal(extFieldInTab({ label: 'x', tab: '折叠棉' }, '垫片'), false)
  assert.equal(extFieldInTab({ label: 'x' }, '折叠棉'), false, '没有 tab ⇒ 不属于任何页签')
  assert.equal(extFieldInTab({ label: 'x', tab: '折叠棉' }, ''), false)
  assert.equal(extFieldInTab({ label: 'x', tab: ' 折叠棉 ' }, '折叠棉'), true, '两侧 trim')
  assert.deepEqual(extFieldsOfTab(EXT, '折叠棉').map((f) => f.label), ['检验方法', '检验标准'])
})

test('固定表只剩三个前置列(物料编号/文件编码/检验依据),其余靠自定义列', () => {
  for (const key of ['折叠棉', '垫片', '无纺布', '网套', 'PP管', '端盖', 'PP棉']) {
    assert.deepEqual(TAB(key).cols.map((c) => c.key), LEAD_KEYS, `${key} 应只剩三个前置列`)
  }
  assert.deepEqual(LEAD_COLS.map((c) => c.key), LEAD_KEYS, 'LEAD_COLS 与页签配置同源')
  const cols = colsOfTab(TAB('折叠棉'), EXT)
  assert.deepEqual(cols.map((c) => c.key), ['物料编号', '文件编码', '检验依据', '检验方法', '检验标准'])
  // 别的表的自定义列不许串进来
  assert.ok(!cols.some((c) => c.key === '平整度'))
})

test('每张表各有各的自定义列(用户口径:单独针对每个表)', () => {
  assert.equal(colsOfTab(TAB('垫片'), EXT).filter((c) => c.key === '检验方法').length, 0)
  assert.deepEqual(colsOfTab(TAB('无纺布'), null).map((c) => c.key), LEAD_KEYS, '没加自定义列的表只有前置列')
})

test('全自定义表(系列面板):匹配键 物料编号 在最左 + 本表的自定义列', () => {
  const cols = colsOfTab(TAB_S('阻垢系列'), EXT)
  assert.equal(cols[0].key, EXT_KEY_COL.key, '物料编号是最左的匹配键列')
  assert.deepEqual(cols.map((c) => c.key), ['物料编号', '文件编码', '检验依据', '平整度'])
  assert.deepEqual(colsOfTab(TAB_S('炭粉'), EXT).map((c) => c.key), LEAD_KEYS, '没加列的表只剩前置列')
})

test('列宽:自定义列走 widthOf 回调(缺省默认宽)', () => {
  const cols = colsOfTab(TAB('折叠棉'), EXT, (label) => (label === '检验方法' ? 200 : 0))
  assert.equal(cols[3].w, 200, 'widthOf 给的宽生效')
  const cols2 = colsOfTab(TAB('折叠棉'), EXT, () => 0)
  assert.equal(cols2[3].w, DEFAULT_EXT_COL_W, '给 0 → 回落默认宽')
  assert.equal(colsOfTab(TAB('折叠棉'), EXT).length, 5, '3 个前置列 + 2 个自定义子列')
})

test('没有动态字段 / 空页签:不报错', () => {
  assert.deepEqual(colsOfTab(TAB('折叠棉'), []).map((c) => c.key), LEAD_KEYS)
  assert.deepEqual(colsOfTab(null, EXT), [])
  assert.deepEqual(colsOfTab(TAB_S('炭粉'), null).map((c) => c.key), LEAD_KEYS)
})

test('tabsOfPanel:固定面板用静态配置;系列面板完全由物料类别词典决定(全自定义)', () => {
  assert.deepEqual(tabsOfPanel('QC_INSP_REQ', ['忽略']).map((t) => t.key), qcInspReqTabs.map((t) => t.key))
  const s = tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, ['阻垢系列', '原料来料'])
  assert.deepEqual(s.map((t) => t.key), ['阻垢系列', '原料来料'], '顺序即词典顺序(扩展池分段序)')
  assert.ok(s.every((t) => t.dynamicCols && t.cols.length === 0), '每张表都是全自定义表')
  assert.deepEqual(tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, []), [], '词典取不到就没页签(不报错)')
})

/* ── 父目录(分组表头):父只做表头分组、没有数据格;一个父带两个子目录 ── */
test('同父的两个子列相邻落在同一分组里(表头才合并得起来)', () => {
  const cols = colsOfTab(TAB('折叠棉'), [
    { label: '检验方法', col: '备用1', tab: '折叠棉', parent: '颗粒安全' },
    { label: '检验标准', col: '备用2', tab: '折叠棉', parent: '颗粒安全' },
    { label: '备注', col: '备用3', tab: '折叠棉' },
  ])
  const keys = cols.map((c) => c.key)
  assert.deepEqual(keys, ['物料编号', '文件编码', '检验依据', '检验方法', '检验标准', '备注'])
  assert.equal(cols.find((c) => c.key === '检验方法').group, '颗粒安全')
  assert.equal(cols.find((c) => c.key === '检验标准').group, '颗粒安全')
  assert.equal(cols.find((c) => c.key === '备注').group, undefined, '无父 ⇒ 独立列')
})

test('父字段候选 = 本页签自定义列已用的父(固定列的分组已随固定列一起删除)', () => {
  const ext = [
    { label: '检验方法', col: '备用1', tab: '垫片', parent: '外观' },
    { label: '检验标准', col: '备用2', tab: '垫片', parent: '外观' },
    { label: '检验方法2', col: '备用41', tab: '无纺布', parent: '可靠性' },
  ]
  assert.deepEqual(parentOptionsOfTab(TAB('垫片'), ext), ['外观'], '去重;不再有旧的「规格」分组')
  assert.deepEqual(parentOptionsOfTab(TAB('无纺布'), ext), ['可靠性'])
  assert.deepEqual(parentOptionsOfTab(null, ext), [])
})

test('列里只有子字段:父名永远不是一列(父行由带入逻辑单独插)', () => {
  const cols = colsOfTab(TAB('折叠棉'), [
    { label: '检验方法', col: '备用1', tab: '折叠棉', parent: '颗粒安全' },
    { label: '检验标准', col: '备用2', tab: '折叠棉', parent: '颗粒安全' },
  ])
  assert.ok(!cols.some((c) => c.key === '颗粒安全'), '父名不是列')
})

/** 源码级回归:渲染与带入必须同源(否则"界面看得到、报告带不进来") */
test('页面接线:检验要求表与带入都走 qcInspReqCols', () => {
  const sheet = readFileSync(new URL('../views/QcInspReqSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /@core\/qc\/qcInspReqCols/, 'QcInspReqSheet 必须用共享列判据')
  assert.match(sheet, /colsOfTab\(/, '列由 colsOfTab 算')
  const carry = readFileSync(new URL('./qcInspReqCarry.js', import.meta.url), 'utf8')
  assert.match(carry, /colsOfTab\(/, '带入同样按 colsOfTab 的列(含每表自定义列)')
})
