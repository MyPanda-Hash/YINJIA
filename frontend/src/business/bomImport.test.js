/**
 * bomImport.test.js — 物料清单(BOM)Excel 导入纯逻辑单测(2026-10-21)
 *
 * 这些断言全部指向具体生产逻辑,任一条改坏都会红:
 *   · templateHeader/templateRows  → 模板列名必须与 WLBOM 面板字段名一致(否则 ImportDialog 匹配不上)
 *   · parseBomSheet                → 必填列缺失/用量非数字/空行跳过 的判定
 *   · groupByProduct               → 同一物料编码合成一张单,组内保序
 *   · buildWlbomForm               → 提交给 /px/callButton 的字段名与 detail 结构
 *   · checkDuplicates              → 同产品子件重复要提示
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_COLUMNS,
  templateHeader,
  templateRows,
  templateNotes,
  parseBomSheet,
  groupByProduct,
  buildWlbomForm,
  checkDuplicates,
} from './bomImport.js'

test('模板列名与 WLBOM 面板字段名一致(导入靠 label 匹配)', () => {
  assert.deepEqual(templateHeader(), [
    '物料编码', '物料名称', '子件代码', '子件名称',
    '规格型号', '子件单位', '标准用量', '损耗量', '单价', '备注',
  ])
  // 必填列只有这三个:少了导入会静默丢数据,多了会逼用户填无用字段
  const required = TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.key)
  assert.deepEqual(required, ['物料编码', '子件代码', '标准用量'])
})

test('模板示例行用库里真实产品 T382,且列数对齐表头', () => {
  const rows = templateRows()
  assert.equal(rows[0].length, TEMPLATE_COLUMNS.length)
  assert.equal(rows[1].length, TEMPLATE_COLUMNS.length)
  assert.equal(rows[1][0], 'T382')
  assert.equal(rows[1][2], 'M-001')
  assert.equal(rows[1][6], 1)
})

test('说明页包含分组规则与必填提示', () => {
  const notes = templateNotes()
  const text = notes.map((r) => r.join(' ')).join('\n')
  assert.match(text, /同一个产品的多行/)
  assert.match(text, /必填/)
  assert.match(text, /标准用量 = 生产 1 个单位成品/)
})

test('parseBomSheet:正常两行 → 解析出两行且数值转成 number', () => {
  const aoa = [
    templateHeader(),
    ['C-95-13', '006项目/功能炭棒滤芯', 'YJ-SX-001-2', '端盖', '57*21', '支', '2', '0.1', '3.5', ''],
    ['C-95-13', '006项目/功能炭棒滤芯', 'YJ-SX-002-2', '端盖', '', '支', 4, '', '', '备注'],
  ]
  const r = parseBomSheet(aoa)
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 2)
  assert.equal(r.rows[0].标准用量, 2)
  assert.equal(r.rows[0].损耗量, 0.1)
  assert.equal(r.rows[0].单价, 3.5)
  assert.equal(r.rows[1].标准用量, 4)   // Excel 数字单元格直接是 number
  assert.equal(r.rows[1].损耗量, 0)     // 空 → 0
  assert.equal(r.rows[1].备注, '备注')
})

test('parseBomSheet:缺必填列 → ok=false 且点名缺哪列', () => {
  const aoa = [['物料编码', '子件名称'], ['C-95-13', '端盖']]
  const r = parseBomSheet(aoa)
  assert.equal(r.ok, false)
  assert.equal(r.rows.length, 0)
  assert.match(r.errors[0], /缺少必填列/)
  assert.match(r.errors[0], /子件代码/)
  assert.match(r.errors[0], /标准用量/)
})

test('parseBomSheet:物料编码/子件代码为空 → 该行报错并跳过,不影响其它行', () => {
  const aoa = [
    templateHeader(),
    ['', '空产品', 'YJ-SX-001-2', '', '', '支', 1, '', '', ''],
    ['C-95-13', '正常', 'YJ-SX-002-2', '', '', '支', 2, '', '', ''],
    ['C-95-13', '空子件', '', '', '', '支', 1, '', '', ''],
  ]
  const r = parseBomSheet(aoa)
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].子件代码, 'YJ-SX-002-2')
  assert.equal(r.errors.length, 2)
  assert.match(r.errors[0], /第 2 行:物料编码为空/)
  assert.match(r.errors[1], /第 4 行:子件代码为空/)
})

test('parseBomSheet:标准用量非数字或 <=0 → 报错', () => {
  const aoa = [
    templateHeader(),
    ['C-95-13', '', 'YJ-SX-001-2', '', '', '支', 'abc', '', '', ''],
    ['C-95-13', '', 'YJ-SX-002-2', '', '', '支', 0, '', '', ''],
    ['C-95-13', '', 'YJ-SX-003-2', '', '', '支', -1, '', '', ''],
  ]
  const r = parseBomSheet(aoa)
  assert.equal(r.rows.length, 0)
  assert.equal(r.errors.length, 3)
  assert.match(r.errors[0], /标准用量「abc」不是大于 0 的数字/)
  assert.match(r.errors[1], /标准用量「0」/)
  assert.match(r.errors[2], /标准用量「-1」/)
})

test('parseBomSheet:空尾行被跳过,不报错', () => {
  const aoa = [
    templateHeader(),
    ['C-95-13', '', 'YJ-SX-001-2', '', '', '支', 1, '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
  ]
  const r = parseBomSheet(aoa)
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 1)
  assert.equal(r.errors.length, 0)
})

test('parseBomSheet:空表 → ok=false', () => {
  assert.equal(parseBomSheet([]).ok, false)
  assert.equal(parseBomSheet(null).ok, false)
  assert.match(parseBomSheet([]).errors[0], /Excel 为空/)
})

test('groupByProduct:同一物料编码合成一张单,组内保序,组间按首次出现', () => {
  const rows = [
    { 物料编码: 'C-95-13', 物料名称: '成品A', 子件代码: 'S1', 标准用量: 2 },
    { 物料编码: 'T201', 物料名称: '成品B', 子件代码: 'S9', 标准用量: 1 },
    { 物料编码: 'C-95-13', 物料名称: '成品A', 子件代码: 'S2', 标准用量: 3 },
  ]
  const g = groupByProduct(rows)
  assert.equal(g.length, 2)
  assert.equal(g[0].product, 'C-95-13')
  assert.deepEqual(g[0].items.map((i) => i.子件代码), ['S1', 'S2'])
  assert.deepEqual(g[0].items.map((i) => i.行序), ['1', '2'])
  assert.equal(g[1].product, 'T201')
  assert.deepEqual(g[1].items.map((i) => i.子件代码), ['S9'])
})

test('groupByProduct:空产品名不覆盖已有的名称', () => {
  const g = groupByProduct([
    { 物料编码: 'C-1', 物料名称: '真名', 子件代码: 'S1', 标准用量: 1 },
    { 物料编码: 'C-1', 物料名称: '', 子件代码: 'S2', 标准用量: 1 },
  ])
  assert.equal(g[0].productName, '真名')
})

test('buildWlbomForm:表头取物料编码+单据日期,明细放 detail.items', () => {
  const g = groupByProduct([
    { 物料编码: 'C-95-13', 物料名称: '成品A', 子件代码: 'S1', 子件名称: '端盖', 标准用量: 2 },
  ])[0]
  const f = buildWlbomForm(g, { date: '2026-10-21' })
  assert.equal(f.物料编码, 'C-95-13')
  assert.equal(f.物料名称, '成品A')
  assert.equal(f.单据日期, '2026-10-21')
  assert.equal(f.detail.items.length, 1)
  assert.equal(f.detail.items[0].子件代码, 'S1')
  assert.equal(f.detail.items[0].标准用量, 2)
  // 单据编号必须留空交给后端 FormNoService 生成
  assert.equal(f.单据编号, undefined)
})

test('checkDuplicates:同产品子件重复要提示,不同产品各自独立', () => {
  const g = groupByProduct([
    { 物料编码: 'C-1', 子件代码: 'S1', 标准用量: 1 },
    { 物料编码: 'C-1', 子件代码: 'S1', 标准用量: 2 },
    { 物料编码: 'C-2', 子件代码: 'S1', 标准用量: 1 },
  ])
  const w = checkDuplicates(g)
  assert.equal(w.length, 1)
  assert.match(w[0], /C-1:子件重复 S1/)
})
