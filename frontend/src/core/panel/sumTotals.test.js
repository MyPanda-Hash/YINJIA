import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decimalsOf, sumKeepScale, sumColumn, MAX_TOTAL_SCALE } from './sumTotals.js'

/**
 * 这组断言守的是 2026-10-03 用户报的问题:
 * 「现在的单据明细与合计的小数点后位数有差距,要合计保持与明细一致」。
 *
 * 背景(实查得出,别退回旧写法):
 *  · 合计原先写死 `Math.round(sum * 100) / 100`(恒 2 位),而单据明细列在 HSDZ_MES 里
 *    绝大多数是 decimal(18,4)(实测 scale=4 = 291 列、scale=2 = 11 列、scale=6 = 8 列)
 *    ⇒ 明细 1.2345 而合计 1.23。
 *  · 汇总页签的分组小计从不收敛,1.1 + 2.2 显示 3.3000000000000003,合计行却是 3.3。
 */

test('decimalsOf:按十进制字面量数小数位', () => {
  assert.equal(decimalsOf(3), 0)
  assert.equal(decimalsOf(1.2), 1)
  assert.equal(decimalsOf(1.2345), 4)
  assert.equal(decimalsOf('2.50'), 1)          // 经 Number 归一,尾随零不算位数(与界面显示一致)
  assert.equal(decimalsOf('abc'), 0)           // 非数值不参与
  assert.equal(decimalsOf(null), 0)
  assert.equal(decimalsOf(1e-7), 7)            // 指数写法要还原成位数
  assert.equal(decimalsOf(1.5e-5), 6)
  assert.equal(decimalsOf(2e3), 0)
})

test('sumKeepScale:合计保留明细里最多的小数位(4 位明细不再被砍成 2 位)', () => {
  assert.equal(sumKeepScale([1.2345, 2.1]), 3.3345)
  assert.equal(sumKeepScale([0.0001, 0.0002]), 0.0003)
  assert.equal(sumKeepScale([1.5, 2]), 3.5)
  assert.equal(sumKeepScale([1, 2, 3]), 6)     // 全整数 → 合计整数
})

test('sumKeepScale:吃掉浮点尾差(旧写法在汇总小计里裸加会露出来)', () => {
  assert.equal(sumKeepScale([0.1, 0.2]), 0.3)
  assert.equal(sumKeepScale([1.1, 2.2]), 3.3)
  assert.equal(sumKeepScale([0.07, 0.01, 0.02]), 0.1)
  assert.equal(String(sumKeepScale([0.1, 0.2])), '0.3')
})

test('sumKeepScale:非数值项跳过;没有可加项返回 null(由调用方决定显示什么)', () => {
  assert.equal(sumKeepScale([1.25, '', null, undefined, 'abc', NaN, Infinity]), 1.25)
  assert.equal(sumKeepScale([]), null)
  assert.equal(sumKeepScale(['', null]), null)
  assert.equal(sumKeepScale(null), null)
})

test('sumKeepScale:字符串数字照收(单元格里是文本 / Excel 导入的行)', () => {
  assert.equal(sumKeepScale(['1.2345', '2.1']), 3.3345)
})

test('sumKeepScale:位数上限可调,默认 10 位(库内最大 scale=6,浮点噪声不当位数)', () => {
  assert.equal(sumKeepScale([1.23456789012], { maxScale: 6 }), 1.234568)
  assert.equal(sumKeepScale([1.23456789012], { maxScale: 2 }), 1.23)
  assert.equal(sumKeepScale([1.23456789012345]), 1.2345678901)   // 默认 10 位
  assert.equal(MAX_TOTAL_SCALE, 10)
})

test('sumKeepScale:负数与混合符号', () => {
  assert.equal(sumKeepScale([1.2345, -0.2345]), 1)
  assert.equal(sumKeepScale([-0.0001, -0.0002]), -0.0003)
})

test('sumColumn:按明细行键取列合计(行键=中文字段名)', () => {
  const rows = [{ 数量: 1.2345 }, { 数量: 2.1 }, { 数量: null }]
  assert.equal(sumColumn(rows, '数量'), 3.3345)
  assert.equal(sumColumn([], '数量'), null)
})
