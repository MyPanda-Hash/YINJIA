/**
 * firstInspCols.test.js — 首件检验「测试项目 = 一列」列模型的单测。
 *
 * 钉住四条用户口径(2026-10-15「测试项目需要可新增,也就是新增列即可」):
 *   ① 加一列 = 1 行标准 + 8 行样品(1#..8#),行键与后端 FirstInspItems 完全一致;
 *   ② 减一列 = 整列(标准行+8 样品行)一起删,别的列一行不动;
 *   ③ 改列名/分组/标准 = 只改显示与标准行,**key 不动**(改 key 等于换列,历史数据会丢);
 *   ④ 列清单从明细折出来:同名 key 只认一次、分组的先后按纸张上的先后。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SAMPLE_COUNT, GROUP_ORDER, ROW_STANDARD, ROW_SAMPLE,
  columnsOf, groupsOf, unitOfLabel, nextColumnKey, nextColumnLabel,
  rowsForColumn, addColumn, removeColumn, updateColumn, columnHasContent, ensureItems,
} from './firstInspCols.js'

const headOf = (items = []) => ({ 单据编号: 'SJ-T-1', detail: { items } })

test('加一列 = 1 行标准 + 8 行样品,行键与后端一致', () => {
  const head = headOf()
  const col = addColumn(head, { label: '炭棒外径mm', group: '尺寸及重量', standard: '外径:34.5±0.5' })
  assert.equal(col.key, '炭棒外径mm')
  assert.equal(col.label, '炭棒外径mm')
  assert.equal(col.rows, SAMPLE_COUNT + 1)
  const items = head.detail.items
  assert.equal(items.length, 9)
  const std = items.find((r) => r['行类型'] === ROW_STANDARD)
  assert.equal(std['标准'], '外径:34.5±0.5')
  assert.equal(std['检验列'], '炭棒外径mm')
  assert.equal(std['项目分组'], '尺寸及重量')
  const samples = items.filter((r) => r['行类型'] === ROW_SAMPLE)
  assert.deepEqual(samples.map((r) => r['样品序号']), ['1#', '2#', '3#', '4#', '5#', '6#', '7#', '8#'])
  // 样品行的「标准」恒空(标准只在标准行上)
  assert.ok(samples.every((r) => r['标准'] === ''))
  // 与后端 FirstInspItems.row(...) 的键集一字不差
  assert.deepEqual(Object.keys(std).sort(), [
    '标准', '备注', '实测数值', '结果判断', '检验列', '检验项目',
    '样品序号', '行号', '行类型', '表区', '项目分组',
  ].sort())
  assert.equal(std['表区'], '首件检验')
})

test('加第二列接在明细末尾,行号不撞', () => {
  const head = headOf()
  addColumn(head, { label: 'A' })
  addColumn(head, { label: 'B' })
  const items = head.detail.items
  assert.equal(items.length, 18)
  const nos = items.map((r) => Number(r['行号']))
  assert.equal(new Set(nos).size, 18, '行号必须唯一')
  assert.deepEqual(columnsOf(items).map((c) => c.key), ['A', 'B'])
})

test('同名再加一列 → key 自动补 -2,不覆盖已有列', () => {
  const head = headOf()
  addColumn(head, { label: '炭棒长度mm' })
  const second = addColumn(head, { label: '炭棒长度mm' })
  assert.equal(second.key, '炭棒长度mm-2')
  assert.deepEqual(columnsOf(head.detail.items).map((c) => c.label), ['炭棒长度mm', '炭棒长度mm'])
})

test('空列名给占位,可改名', () => {
  const head = headOf()
  const c = addColumn(head, { label: '   ' })
  assert.equal(c.label, '测试项目1')
  const c2 = addColumn(head, {})
  assert.equal(c2.label, '测试项目2')
})

test('减一列:整列 9 行一起走,别的列一行不动', () => {
  const head = headOf()
  addColumn(head, { label: 'A' })
  addColumn(head, { label: 'B' })
  // B 填两个格
  const b1 = head.detail.items.find((r) => r['检验列'] === 'B' && r['样品序号'] === '1#')
  b1['实测数值'] = '11.1'
  assert.equal(columnHasContent(head.detail.items, 'B'), true)
  assert.equal(columnHasContent(head.detail.items, 'A'), false)
  assert.equal(removeColumn(head, 'B'), 9)
  assert.equal(head.detail.items.length, 9)
  assert.ok(head.detail.items.every((r) => r['检验列'] === 'A'))
})

test('改列名/分组/标准:明细该列全行同改,key 不动(历史数据不丢)', () => {
  const head = headOf()
  addColumn(head, { label: 'A', group: '强度', standard: '旧标准' })
  const n = updateColumn(head, 'A', { label: '挤压强度', group: '强度', standard: '新标准' })
  assert.equal(n, 9)
  const items = head.detail.items
  assert.ok(items.every((r) => r['检验项目'] === '挤压强度'))
  assert.ok(items.every((r) => r['检验列'] === 'A'), 'key 必须不动')
  assert.equal(items.find((r) => r['行类型'] === ROW_STANDARD)['标准'], '新标准')
  // 样品行的标准不被 patch 写脏
  assert.ok(items.filter((r) => r['行类型'] === ROW_SAMPLE).every((r) => r['标准'] === ''))
})

test('列清单从明细折出:同 key 只认一次,分组按纸张先后', () => {
  const items = [
    { 检验列: 'b', 检验项目: '浊度NTU', 项目分组: '浊度及压降', 标准: '/' },
    { 检验列: 'a', 检验项目: '炭棒外径mm', 项目分组: '尺寸及重量', 标准: '外径:1' },
    { 检验列: 'a', 检验项目: '炭棒外径mm', 项目分组: '尺寸及重量' },
  ]
  const cols = columnsOf(items)
  assert.equal(cols.length, 2, '同 key 只能出一列')
  assert.deepEqual(cols.map((c) => c.key), ['b', 'a'], '列序 = 明细里首次出现的先后')
  assert.deepEqual(groupsOf(cols), ['尺寸及重量', '浊度及压降'], '组的先后按纸张上的先后(不是录入先后)')
})

test('未知分组排在最后,不丢列', () => {
  const cols = columnsOf([
    { 检验列: 'x', 检验项目: '自定义项', 项目分组: '我的分组' },
    { 检验列: 'y', 检验项目: '跌落', 项目分组: '强度' },
  ])
  assert.deepEqual(groupsOf(cols), ['强度', '我的分组'])
})

test('列头单位:能从列名看出来的才写,不从 key 猜', () => {
  assert.equal(unitOfLabel('炭棒外径mm'), 'mm')
  assert.equal(unitOfLabel('跌落高度cm'), 'cm')
  assert.equal(unitOfLabel('炭棒重量g'), 'g')
  assert.equal(unitOfLabel('浊度NTU'), 'NTU')
  assert.equal(unitOfLabel('压降kPa'), 'kPa')
  assert.equal(unitOfLabel('挤压强度kgf'), 'kgf')
  assert.equal(unitOfLabel('跌落'), '')
})

test('rowsForColumn 的行号从给定起点之后连续(不与传入的已有最大号撞)', () => {
  const rows = rowsForColumn({ key: 'k', label: 'k', group: '强度' }, 100)
  assert.equal(rows.length, 9)
  assert.deepEqual(rows.map((r) => r['行号']), [101, 102, 103, 104, 105, 106, 107, 108, 109])
})

test('ensureItems:head.detail 缺失/不是数组都能补出来', () => {
  const h1 = {}
  assert.equal(ensureItems(h1).length, 0)
  const h2 = { detail: {} }
  assert.equal(ensureItems(h2).length, 0)
  const h3 = { detail: { items: 'oops' } }
  assert.equal(ensureItems(h3).length, 0)
})

test('未分组按纸张先后:表头 colspan 与表体列序必须一致(截图实测踩过)', () => {
  // 表头第一级 = 分组(colspan = 本组列数),表体 = 一格一列。
  // 若表体按"录入先后"平铺、表头按"分组先后"归并,两行列就对不上(第二列的分组名并进第一组、格子整体右移)。
  // ⇒ 统一的列序 = groupsOf × 组内列序;这里钉住"表头展开后的列序 === 表体列序"。
  const cols = columnsOf([
    // 录入先后故意与纸张分组先后相反:浊度(第4组)先录,炭棒表观(第1组)后录
    { 检验列: 'turbidity', 检验项目: '浊度NTU', 项目分组: '浊度及压降' },
    { 检验列: 'appearance', 检验项目: '炭棒表观状态', 项目分组: '表观及脱粉' },
  ])
  const ordered = groupsOf(cols).flatMap((g) => cols.filter((c) => c.group === g))
  // 表头:按 groupsOf 依次列出每组、组内列出该组的列
  const headerFlat = groupsOf(cols).flatMap((g) => ordered.filter((c) => c.group === g))
  assert.deepEqual(headerFlat.map((c) => c.key), ordered.map((c) => c.key),
    '表头展开的列序必须等于表体列序')
  assert.deepEqual(ordered.map((c) => c.key), ['appearance', 'turbidity'],
    '纸张分组先后 = 表观及脱粉 → 浊度及压降(不是录入先后)')
  // 每组 colspan 之和 = 列数(表头两行宽度必须对得上表体)
  const span = groupsOf(cols).reduce((n, g) => n + ordered.filter((c) => c.group === g).length, 0)
  assert.equal(span, ordered.length, 'colspan 合计必须等于列数')
})

test('nextColumnKey / nextColumnLabel 只在冲突时让号', () => {
  const cols = [{ key: 'X', label: 'X' }]
  assert.equal(nextColumnKey(cols, 'Y'), 'Y')
  assert.equal(nextColumnKey(cols, 'X'), 'X-2')
  assert.equal(nextColumnLabel([{ label: '测试项目1' }]), '测试项目2')
  assert.equal(GROUP_ORDER.length, 4)
})
