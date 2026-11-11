import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carryKeyOf,
  carryEntriesOf,
  missingCarryRows,
  carryPlan,
  carryHeadOf,
  CARRY_HEAD_KEYS,
} from './qcInspReqCarry.js'
import { lookupReqGroups } from './qcInspReqLookup.js'
import { tabsOfPanel, QC_INSP_REQ_SERIES_PANEL } from '../views/qcInspReqConfig.js'

/**
 * 2026-11-11 最终口径:自定义字段 = 「一个父目录 + 两个子目录」,
 * 带入检验报告**只占一行**:
 *   检验项 = 父目录名(父自己没有数据,只显示标题)
 *   检测标准 = 子目录1 的数据
 *   检验方法 = 子目录2 的数据
 * 判定:名字带「方法」→ 检验方法列;带「标准」→ 检测标准列;看不出来 → 按子列顺序(1→标准,2→方法)。
 */
const SERIES_TABS = tabsOfPanel(QC_INSP_REQ_SERIES_PANEL, ['矿化料', '阻垢系列'])
const EXT = [
  { id: 1, label: '检验方法', col: '备用1', tab: '矿化料', parent: '颗粒安全' },
  { id: 2, label: '检验标准', col: '备用2', tab: '矿化料', parent: '颗粒安全' },
]
const ROW = {
  id: 30,
  物料类别: '矿化料',
  物料编号: 'YJ-XH-001',
  文件编码: 'YJ-QR-112',
  检验依据: 'YJ-Q-129',
  检验方法: '取3g原材料研磨，筛分-120目…',
  检验标准: '镉(mg/g)≤0.005、铅(mg/g)≤0.05',
}

test('carryKeyOf:去掉所有空白后比 —— 排版差异不算两项', () => {
  assert.equal(carryKeyOf(' 外径 '), '外径')
  assert.equal(carryKeyOf('外径 1'), carryKeyOf('外径1'))
  assert.equal(carryKeyOf(null), '')
})

test('一个父目录 = 报告里一行:检验项=父目录名,检测标准/检验方法=两个子目录的数据', () => {
  const entries = carryEntriesOf(lookupReqGroups([ROW], 'YJ-XH-001', SERIES_TABS), EXT)
  assert.deepEqual(entries, [{
    检验项: '颗粒安全',
    检测标准: '镉(mg/g)≤0.005、铅(mg/g)≤0.05',
    检验方法: '取3g原材料研磨，筛分-120目…',
  }], '只有一行,父目录不单独占行')
})

test('子目录名看不出方向时按顺序:第 1 个子列进 检测标准,第 2 个进 检验方法', () => {
  const ext = [
    { id: 1, label: '子目录1', col: '备用1', tab: '矿化料', parent: '颗粒安全' },
    { id: 2, label: '子目录2', col: '备用2', tab: '矿化料', parent: '颗粒安全' },
  ]
  const row = { 物料类别: '矿化料', 物料编号: 'YJ-XH-001', 子目录1: 'A值', 子目录2: 'B值' }
  const entries = carryEntriesOf(lookupReqGroups([row], 'YJ-XH-001', SERIES_TABS), ext)
  assert.deepEqual(entries, [{ 检验项: '颗粒安全', 检测标准: 'A值', 检验方法: 'B值' }])
})

test('两个子目录都空 ⇒ 整组不出行', () => {
  const empty = { ...ROW, 检验方法: '', 检验标准: null }
  assert.deepEqual(carryEntriesOf(lookupReqGroups([empty], 'YJ-XH-001', SERIES_TABS), EXT), [])
})

test('只有一个子目录有数据 ⇒ 另一格留空,仍是一行', () => {
  const half = { ...ROW, 检验方法: '' }
  assert.deepEqual(carryEntriesOf(lookupReqGroups([half], 'YJ-XH-001', SERIES_TABS), EXT), [{
    检验项: '颗粒安全', 检测标准: '镉(mg/g)≤0.005、铅(mg/g)≤0.05', 检验方法: '',
  }])
})

test('文件编码/检验依据只进抬头,不成检验项', () => {
  const plan = carryPlan([ROW], 'YJ-XH-001', [], EXT, SERIES_TABS)
  const items = plan.entries.map((e) => e.检验项)
  assert.ok(!items.includes('文件编码') && !items.includes('检验依据'), '这两个只进抬头')
  assert.deepEqual(plan.head, { 文件编码: 'YJ-QR-112', 检验依据: 'YJ-Q-129' })
  assert.deepEqual([...CARRY_HEAD_KEYS], ['文件编码', '检验依据'])
})

test('标识列不进检验项(物料编号/物料类别/id 永不成为检验项)', () => {
  const items = carryEntriesOf(lookupReqGroups([ROW], 'YJ-XH-001', SERIES_TABS), EXT).map((e) => e.检验项)
  assert.ok(!items.includes('物料编号'))
  assert.ok(!items.includes('物料类别'))
  assert.ok(!items.includes('id'))
})

test('只补缺失项:已有的行保留(结果格/判定不动),缺的不补', () => {
  const entries = carryEntriesOf(lookupReqGroups([ROW], 'YJ-XH-001', SERIES_TABS), EXT)
  const existing = [{ 检验项: '颗粒安全', 检测标准: '旧值', 结果1: '无异常', 单项判定: '合格' }]
  const add = missingCarryRows(existing, entries)
  assert.deepEqual(add, [], '已有同名检验项 ⇒ 不再补')
  assert.equal(existing[0].结果1, '无异常', '已有行原样不动')
})

test('幂等:补过一遍之后再点带入,一行都不加', () => {
  const plan1 = carryPlan([ROW], 'YJ-XH-001', [], EXT, SERIES_TABS)
  assert.equal(plan1.add.length, 1)
  const after = plan1.add.map((r) => ({ ...r, 结果1: '合格' }))
  const plan2 = carryPlan([ROW], 'YJ-XH-001', after, EXT, SERIES_TABS)
  assert.deepEqual(plan2.add, [])
  assert.equal(plan2.entries.length, 1, '条目本身照旧全量给出')
})

test('抬头带入:要求表没填的两项不返回(调用方保留报告原值)', () => {
  const bare = { 物料类别: '矿化料', 物料编号: 'YJ-XH-001', 检验方法: 'x', 检验标准: 'y' }
  assert.deepEqual(carryHeadOf(lookupReqGroups([bare], 'YJ-XH-001', SERIES_TABS)), {})
})

/** 源码级回归:渲染与带入必须同源(否则"界面看得到、报告带不进来") */
test('页面接线:要求表与带入同源;报告表体必须有检验方法列', () => {
  const sheet = readFileSync(new URL('../views/QcInspReqSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /@core\/qc\/qcInspReqCols/)
  const rec = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(rec, /K\.METHOD/, '报告表体必须渲染检验方法列')
  assert.match(rec, /\[K\.METHOD\]: e\.检验方法/, '带入落行时必须把 检验方法 一起写进报告行(漏了会静默丢数据)')
  const carry = readFileSync(new URL('./qcInspReqCarry.js', import.meta.url), 'utf8')
  assert.match(carry, /colsOfTab\(/, '带入同样按 colsOfTab 的列')
  assert.match(carry, /检验方法/, '带入要判断哪个子目录进检验方法列')
})
