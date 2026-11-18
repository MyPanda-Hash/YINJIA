/**
 * 样品进度跟踪（2026-11-18 用户口径，Excel #9）—— 节点推导与检索口径。
 *
 * 后端只回原始标记（pending / approve_node / archived / canceled），节点文案在这里推导：
 *   作废 > 归档 > 待二级 > 待一级 > 草稿（顺序不能反：作废单不该显示成"进行中"）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { filterSampleRows, sampleKpisOf, sampleNodeOf, sampleNodeText } from './sampleFlow.js'

test('节点推导：草稿 / 待一级 / 待二级 / 已完成 / 已作废', () => {
  assert.equal(sampleNodeOf({ pending: 'N', archived: 'N', canceled: 'N' }), 'draft')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 1 }), 'l1')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 0 }), 'l1', '节点为空也按一级待审')
  assert.equal(sampleNodeOf({ pending: 'Y', approve_node: 2 }), 'l2')
  assert.equal(sampleNodeOf({ pending: 'Y', archived: 'Y' }), 'done')
  assert.equal(sampleNodeOf({ pending: 'Y', canceled: 'Y' }), 'void', '作废优先级最高')
  assert.equal(sampleNodeText({ pending: 'Y', approve_node: 2 }), '待二级确认')
})

test('KPI 不计作废单', () => {
  const k = sampleKpisOf([
    { pending: 'N', archived: 'N', canceled: 'N' },   // 草稿 → 计入总数
    { pending: 'Y', approve_node: 1 },                 // 待一级
    { pending: 'Y', approve_node: 2 },                 // 待二级
    { archived: 'Y' },                                 // 完成
    { canceled: 'Y' },                                 // 作废 → 不计
  ])
  assert.deepEqual(k, { total: 4, l1: 1, l2: 1, done: 1 })
})

test('检索：单号 / 客户 / 审核人 / 确认人 / 进度描述 都可命中，支持片段与大小写', () => {
  const rows = [
    { 单据编号: 'liulei-2026-11-18-01', 客户名称: '傲美', 审核人: '刘磊/2026.11.18', 确认人: '', 进度描述: '已寄样' },
    { 单据编号: 'SPW-2026-11-0011', 客户名称: '飞利浦', 审核人: '', 确认人: '冯总/2026.11.18', 进度描述: '待确认' },
  ]
  assert.equal(filterSampleRows(rows, '').length, 2, '空关键字不过滤')
  assert.deepEqual(filterSampleRows(rows, '傲美').map((r) => r.单据编号), ['liulei-2026-11-18-01'])
  assert.deepEqual(filterSampleRows(rows, 'LIULEI').map((r) => r.单据编号), ['liulei-2026-11-18-01'], '忽略大小写')
  assert.deepEqual(filterSampleRows(rows, '冯总').map((r) => r.单据编号), ['SPW-2026-11-0011'], '确认人也参与匹配')
  assert.deepEqual(filterSampleRows(rows, '寄样').map((r) => r.单据编号), ['liulei-2026-11-18-01'], '进度描述参与匹配')
  assert.equal(filterSampleRows(rows, '不存在的词').length, 0)
})
