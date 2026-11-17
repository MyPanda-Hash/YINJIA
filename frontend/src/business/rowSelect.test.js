/**
 * rowSelect.test.js — 「点整行即勾选」判据单测(2026-11-17)
 *
 * 钉住用户口径的边界:
 *   · 点普通单元格 = 翻转勾选(用户口径:「点这一行就行,不用非点小方框」)
 *   · 点复选框 = 不处理(它自己已经翻过一次,再翻就是"点了没反应")
 *   · 点格内控件(input/日期选择器/链接/按钮)= 不处理(用户是想改数或跳转,不是选行)
 *   · 页面自己的可点格子(.dp-plan)只在传了 extra 的页面里跳过
 *   · 表格没就绪 / 行是空 = 不炸
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRowToggleClick, toggleRowOnRowClick, ROW_CLICK_SKIP } from './rowSelect.js'

/** 造一个能"命中祖先链"的假 target:closest(sel) 只看 sel 里有没有我要的类 */
function fakeTarget(...hit) {
  const has = (sel) => hit.some((h) => sel.split(',').map((x) => x.trim()).includes(h))
  return { closest: (sel) => (has(sel) ? { fake: true } : null) }
}

/** 造一个最简 el-table:selection 数组 + toggleRowSelection 记录 */
function fakeTable(selected = []) {
  const calls = []
  const sel = [...selected]
  return {
    calls,
    getSelectionRows: () => sel,
    toggleRowSelection(row, on) {
      calls.push([row, on])
      const i = sel.indexOf(row)
      if (on && i === -1) sel.push(row)
      if (!on && i !== -1) sel.splice(i, 1)
    },
  }
}

const rowA = { 行id: 1 }
const rowB = { 行id: 2 }

test('普通单元格点击 ⇒ 可以翻勾选', () => {
  assert.equal(isRowToggleClick(fakeTarget('td')), true)
})

test('点复选框(含 __inner)⇒ 不翻(避免翻两次)', () => {
  assert.equal(isRowToggleClick(fakeTarget('.el-checkbox')), false)
  assert.equal(isRowToggleClick(fakeTarget('.el-checkbox__inner')), false)
})

test('点格内控件 ⇒ 不翻', () => {
  for (const hit of ['input', '.el-input-number', '.el-date-editor', '.el-link', 'a', 'button', '.el-select']) {
    assert.equal(isRowToggleClick(fakeTarget(hit)), false, `${hit} 应被当成控件`)
  }
})

test('页面私货格子只在 extra 里跳过', () => {
  const t = fakeTarget('.dp-plan')
  assert.equal(isRowToggleClick(t), true, '不传 extra 时 .dp-plan 不特殊')
  assert.equal(isRowToggleClick(t, '.dp-plan'), false, '传了 extra 就归格内编辑')
})

test('拿不到 target 按可以翻处理(别点了没反应)', () => {
  assert.equal(isRowToggleClick(null), true)
  assert.equal(isRowToggleClick(undefined), true)
  assert.equal(isRowToggleClick({}), true)
})

test('未勾的行 ⇒ toggle(row, true)', () => {
  const table = fakeTable([])
  assert.equal(toggleRowOnRowClick(table, rowA, { target: fakeTarget('td') }), true)
  assert.deepEqual(table.calls, [[rowA, true]])
})

test('已勾的行 ⇒ toggle(row, false)', () => {
  const table = fakeTable([rowA])
  assert.equal(toggleRowOnRowClick(table, rowA, { target: fakeTarget('td') }), true)
  assert.deepEqual(table.calls, [[rowA, false]])
})

test('点复选框 ⇒ 一次都不调表格(交给 el-checkbox 自己翻)', () => {
  const table = fakeTable([])
  assert.equal(toggleRowOnRowClick(table, rowA, { target: fakeTarget('.el-checkbox') }), false)
  assert.deepEqual(table.calls, [])
})

test('点 extra 格子 ⇒ 不调表格', () => {
  const table = fakeTable([])
  assert.equal(toggleRowOnRowClick(table, rowA, { target: fakeTarget('.dp-plan') }, { extra: '.dp-plan' }), false)
  assert.deepEqual(table.calls, [])
})

test('表格没就绪 / 行为空 ⇒ 返回 false 不炸', () => {
  assert.equal(toggleRowOnRowClick(null, rowA, { target: fakeTarget('td') }), false)
  assert.equal(toggleRowOnRowClick(fakeTable([]), null, { target: fakeTarget('td') }), false)
  assert.equal(toggleRowOnRowClick({}, rowA, { target: fakeTarget('td') }), false)
  assert.equal(toggleRowOnRowClick(fakeTable([]), rowB, undefined), true, '没有 event 也要能翻')
})

test('多行叠翻:点 A 再点 B ⇒ 两行都在勾选里', () => {
  const table = fakeTable([])
  toggleRowOnRowClick(table, rowA, { target: fakeTarget('td') })
  toggleRowOnRowClick(table, rowB, { target: fakeTarget('td') })
  assert.deepEqual(table.getSelectionRows(), [rowA, rowB])
})

test('控件选择器表里不该混进纯展示标签(否则点状态标签就不选行)', () => {
  assert.equal(ROW_CLICK_SKIP.includes('.el-tag'), false)
})
