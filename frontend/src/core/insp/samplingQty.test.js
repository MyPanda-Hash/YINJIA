/**
 * samplingQty.test.js —— 「取样要求 → 抽检量」解析口径的回归闸(2026-11-13 保存 8114 事故)
 *
 * 事故:标准库「取样要求」是自由文本,被原样写进 decimal 列「抽检量」⇒ 保存 500
 * (SQL state S0005 / error 8114 / nvarchar→numeric)。本测试钉住:
 *   ① 只有**明确的数量写法**才允许写进抽检量(纯数字 / 数字+计量单位);
 *   ② 任何"像数量但不是"的文本(称取100g / 每批5件 / 全检)必须返回 null —— 宁可不填,不猜;
 *   ③ 空值/缺省返回 null,不产生 0(写 0 会覆盖成"抽检 0 件"这种假数据)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSamplingQty } from './samplingQty.js'

test('纯数字:整数/小数/前后空格都认', () => {
  assert.equal(parseSamplingQty('5'), 5)
  assert.equal(parseSamplingQty('5.5'), 5.5)
  assert.equal(parseSamplingQty(' 10 '), 10)
  assert.equal(parseSamplingQty(8), 8)
})

test('数字+计量单位:按历史回填口径取数字部分(nPCS→n 等)', () => {
  assert.equal(parseSamplingQty('5PCS'), 5)
  assert.equal(parseSamplingQty('5 pcs'), 5)
  assert.equal(parseSamplingQty('100PCS'), 100)
  assert.equal(parseSamplingQty('5件'), 5)
  assert.equal(parseSamplingQty('10个'), 10)
  assert.equal(parseSamplingQty('2支'), 2)
})

test('自由文本一律不认(宁可不填,不猜):称取100g / 每批5件 / 全检 / 标准号', () => {
  assert.equal(parseSamplingQty('称取100g'), null)
  assert.equal(parseSamplingQty('每批5件'), null)
  assert.equal(parseSamplingQty('每批抽 5 件'), null)
  assert.equal(parseSamplingQty('全检'), null)
  assert.equal(parseSamplingQty('按GB2828抽样'), null)
  assert.equal(parseSamplingQty('3~5PCS'), null)
  assert.equal(parseSamplingQty('5PCS/批'), null)
})

test('空值/缺省返回 null(不写成 0)', () => {
  assert.equal(parseSamplingQty(''), null)
  assert.equal(parseSamplingQty('   '), null)
  assert.equal(parseSamplingQty(null), null)
  assert.equal(parseSamplingQty(undefined), null)
  assert.equal(parseSamplingQty(NaN), null)
})
