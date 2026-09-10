import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROGRESS_COLUMNS,
  RD_PROGRESS_DETAIL_COLUMNS,
  columnByLabel,
  dataKeyOf,
  readCell,
} from './progressColumns.js'

/**
 * 这条断言守的是 2026-09-10 那个 bug:
 * 前端拿"显示名"当数据键 → 后端按元数据过滤 → 值保存时被静默丢弃。
 * 只要某个 key 不在 RD_PROGRESS 明细列里,保存就一定丢,必须在这里拦住。
 */
test('每个可落库列的 key 必须存在于 RD_PROGRESS 明细元数据列里', () => {
  const bad = PROGRESS_COLUMNS
    .filter((c) => !c.pendingAlign)
    .filter((c) => !RD_PROGRESS_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [], `以下列的落库键不在 rd_progress_detail / yj_field 里,保存会被丢弃:\n  ${bad.join('\n  ')}`)
})

test('列数固定为 14,且显示名不重复', () => {
  assert.equal(PROGRESS_COLUMNS.length, 14)
  assert.equal(new Set(PROGRESS_COLUMNS.map((c) => c.label)).size, 14)
})

/**
 * 尚未与元数据对齐的列必须**显式标记** pendingAlign,
 * 这样它们不会被误当成"能落库",将来对齐时也必须来改这个数字。
 */
test('暂未对齐的列必须显式标记,且数量被钉住(当前 3 列)', () => {
  const pending = PROGRESS_COLUMNS.filter((c) => c.pendingAlign).map((c) => c.label)
  assert.deepEqual(pending, ['技术目标达成', '是否市场转化', '未转换原因'])
})

test('已对齐列的 key 不应等于显示名(否则说明还没改名)', () => {
  // 允许真正同名的那几列:项目名称 / 子项目/尺寸 / 内容 / 状态
  const sameName = ['项目名称', '子项目/尺寸', '内容', '状态']
  const suspicious = PROGRESS_COLUMNS
    .filter((c) => !c.pendingAlign && !sameName.includes(c.label))
    .filter((c) => c.key === c.label)
    .map((c) => c.label)
  assert.deepEqual(suspicious, [], `这些列仍在用显示名当数据键: ${suspicious.join(', ')}`)
})

test('dataKeyOf:未对齐列返回 null(只显示不落库)', () => {
  assert.equal(dataKeyOf('项目负责人'), '项目负责')
  assert.equal(dataKeyOf('预计完成日期'), '里程完成')
  assert.equal(dataKeyOf('技术目标达成'), null)
  assert.equal(dataKeyOf('不存在的列'), null)
})

test('readCell:兼容历史 Excel 表头别名', () => {
  assert.equal(readCell({ 子项目尺寸: 'L3' }, '子项目/尺寸'), 'L3')
  assert.equal(readCell({ '子项目/尺寸': 'L2' }, '子项目/尺寸'), 'L2')
  assert.equal(readCell({ 项目负责人: '陈秀丽' }, '项目负责人'), '陈秀丽')
  assert.equal(columnByLabel('测试情况').key, '测试员')
})

/**
 * 源码级回归:组件里**不允许**把"显示名"当作数据键写进对象字面量。
 * 2026-09-10 踩过:批量把 row['X'] 改成 row[K['X']] 时漏了 { '项目等级': lv } 这种
 * 对象字面量写法,结果"新增项目"建出来的行等级键仍是显示名 → 保存被丢弃 + 同等级块查找失效。
 * 这条断言直接扫组件源码,把这一类"漏替换"钉死。
 */
test('组件源码里不得把显示名当对象字面量的数据键', () => {
  const src = readFileSync(new URL('../views/ProgressControlSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const col of PROGRESS_COLUMNS) {
    // 显示名与数据键本来就相同的列(项目名称/内容/状态/子项目尺寸)不受此约束
    if (col.pendingAlign || col.key === col.label) continue
    if (new RegExp(`'${escapeRe(col.label)}'\\s*:`).test(src)) bad.push(`${col.label} (应为 ${col.key})`)
  }
  assert.deepEqual(bad, [], `组件里仍把显示名当数据键,保存会被丢弃:\n  ${bad.join('\n  ')}`)
})

test('组件源码里不得出现裸的显示名方括号取值(必须经 K 映射)', () => {
  const src = readFileSync(new URL('../views/ProgressControlSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const col of PROGRESS_COLUMNS) {
    if (col.pendingAlign) continue
    if (new RegExp(`(?<!K)\\['${escapeRe(col.label)}'\\]`).test(src)) bad.push(col.label)
  }
  assert.deepEqual(bad, [], `这些列仍用显示名直接取值: ${bad.join(', ')}`)
})

/** 正则转义(中文标签里含 / 等字符) */
function escapeRe(s) {
  return s.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&')
}
