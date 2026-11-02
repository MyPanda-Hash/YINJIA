/**
 * scheduleFilter.test.js — 快速排产 ②「已排产」本地筛选单测(2026-10-28)
 *
 * 钉住用户口径的边界:
 *   · 空条件 = 原样返回(不能把没筛选当成"筛没了")
 *   · 单关键字 = 跨列子串模糊匹配(单号/品名/型号/批次/产线…)
 *   · 空格分词 = 每个词都要命中(AND),不是任一命中(OR)
 *   · 生产线 / 生产状态 = 精确等值,与关键字叠加(AND)
 *   · 脏值安全:null/undefined/数字都不炸
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterScheduled, isFiltering, SCHEDULED_SEARCH_FIELDS } from './scheduleFilter.js'

const rows = [
  {
    加工单号: 'GD-2026-10-0218', 工单行号: 3, 批次号: '20261018',
    产品编号: 'A-32-33', 品名: 'S阻垢炭棒/滤芯', 型号: '40.5*16*80',
    生产线: '装箱2(新厂)', 排产班组: '甲班', 生产状态: '进行中',
    计划线: '成型:切炭3(新厂) → 切炭:切炭3(新厂) → 组装:装箱2(新厂)',
  },
  {
    加工单号: 'GD-2026-10-0223', 工单行号: 1, 批次号: '',
    产品编号: 'B-01-02', 品名: 'A级烧结炭棒/滤芯', 型号: '50*20*90',
    生产线: '1号机', 排产班组: '', 生产状态: '未开工',
    计划线: '',
  },
  {
    加工单号: 'GD-2026-10-0224', 工单行号: 1, 批次号: null,
    产品编号: null, 品名: null, 型号: null,
    生产线: '7号机', 排产班组: null, 生产状态: null,
    计划线: null,
  },
]

test('空条件:原样返回(不复制、不丢行)', () => {
  const got = filterScheduled(rows, {})
  assert.equal(got.length, 3)
  assert.equal(got[0], rows[0])
  assert.equal(filterScheduled(rows).length, 3)
  assert.deepEqual(filterScheduled(undefined, {}), [])
})

test('单关键字:跨列子串模糊,不分大小写', () => {
  assert.deepEqual(filterScheduled(rows, { keyword: '0218' }).map((r) => r.加工单号), ['GD-2026-10-0218'])
  assert.deepEqual(filterScheduled(rows, { keyword: '阻垢' }).map((r) => r.加工单号), ['GD-2026-10-0218'])
  assert.deepEqual(filterScheduled(rows, { keyword: '装箱2' }).map((r) => r.加工单号), ['GD-2026-10-0218'])
  assert.deepEqual(filterScheduled(rows, { keyword: 'gd-2026-10-0223' }).map((r) => r.加工单号), ['GD-2026-10-0223'])
  // 数字也能命中 工单行号/批次号
  assert.equal(filterScheduled(rows, { keyword: '20261018' }).length, 1)
})

test('空格分词:每个词都要命中(AND),不是任一命中', () => {
  assert.equal(filterScheduled(rows, { keyword: '阻垢 0218' }).length, 1)
  assert.equal(filterScheduled(rows, { keyword: '阻垢 0223' }).length, 0)   // 两个词分属不同行 ⇒ 0
  assert.equal(filterScheduled(rows, { keyword: '  阻垢   0218  ' }).length, 1)  // 多空格/首尾空格
})

test('生产线 / 生产状态:精确等值,并与关键字叠加', () => {
  assert.deepEqual(filterScheduled(rows, { line: '1号机' }).map((r) => r.加工单号), ['GD-2026-10-0223'])
  assert.deepEqual(filterScheduled(rows, { status: '进行中' }).map((r) => r.加工单号), ['GD-2026-10-0218'])
  assert.equal(filterScheduled(rows, { line: '1号机', keyword: '阻垢' }).length, 0)
  // 前缀不算命中(精确口径,避免"选组装线把组装2也带出来"这类误判)
  assert.equal(filterScheduled(rows, { line: '1号' }).length, 0)
})

test('脏值安全:null/undefined 单元格不炸、不误命中', () => {
  assert.equal(filterScheduled(rows, { keyword: 'undefined' }).length, 0)
  assert.equal(filterScheduled(rows, { keyword: 'null' }).length, 0)
  // 脏行(null/undefined)在**有筛选**时被剔除;空条件按契约原样返回(不复制、不越权)
  assert.deepEqual(filterScheduled([null, undefined, rows[2]], { keyword: '0224' }), [rows[2]])
  assert.equal(filterScheduled([null, undefined], {}).length, 2)
})

test('isFiltering:三个条件任一非空即筛选态', () => {
  assert.equal(isFiltering({}), false)
  assert.equal(isFiltering({ keyword: '  ' }), false)
  assert.equal(isFiltering({ keyword: 'x' }), true)
  assert.equal(isFiltering({ line: '1号机' }), true)
  assert.equal(isFiltering({ status: '进行中' }), true)
})

test('搜索列清单 = ② 表格里看得见的业务列(漏列会让人"明明有却搜不到")', () => {
  for (const k of ['加工单号', '工单行号', '批次号', '产品编号', '品名', '型号', '生产线', '排产班组', '计划线']) {
    assert.ok(SCHEDULED_SEARCH_FIELDS.includes(k), `缺少可搜列 ${k}`)
  }
})
