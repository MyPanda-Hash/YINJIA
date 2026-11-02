/**
 * prodPickCarry.test.js —— 规格书封面「引用产品信息表」的落值口径
 *
 * 2026-11-02 用户报障：「产品信息表的应用场景以及其他字段不能在规格书中带入」。
 * 根因是 prodPick.map 漏了 应用场景（源表 2026-10-30 补了列，map 没跟），
 * 而这段落值逻辑当时写在 6000 行的组件里，除了跑整个弹窗没法验。
 * 这里钉住三件事：空值不回填、数组来源按序取第一个非空、带入项数 = 真正有值的格数。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCoverPatch, carryValueOf } from './prodPickCarry.js'

test('空值不回填 —— 源表是空的就一个格都不写（拿空串冲掉已录内容等于丢数据）', () => {
  const row = { 产品编号: '0341654', 产品名称: 'cacac', 应用场景: '   ', 产品类别: null }
  const map = [
    { from: '产品编号', to: '产品编号' },
    { from: '产品名称', to: '名称' },
    { from: '应用场景', to: '应用场景' },
    { from: '产品类别', to: '产品类别' },
  ]
  assert.deepEqual(buildCoverPatch(row, map), { 产品编号: '0341654', 名称: 'cacac' })
})

test('带空格的值算空白；数字 0 算有值（0 不是"没填"）', () => {
  assert.equal(carryValueOf({ x: '  ' }, 'x'), '')
  assert.equal(carryValueOf({ x: null }, 'x'), '')
  assert.equal(carryValueOf({ x: 0 }, 'x'), '0')
  assert.equal(carryValueOf({ x: '  33mm  ' }, 'x'), '33mm', '取值要 trim，别把定长列尾空格带进单据')
})

test('数组来源按顺序取第一个非空（客户（项目）名称 ← 客户项目名称 / 客户名称）', () => {
  const map = [{ from: ['客户项目名称', '客户名称'], to: '客户项目名称' }]
  assert.deepEqual(buildCoverPatch({ 客户项目名称: '', 客户名称: 'casca' }, map), { 客户项目名称: 'casca' },
    '产品信息表里客户项目名称空着、客户名称有值 ⇒ 封面那格应该是客户名，不该空着')
  assert.deepEqual(buildCoverPatch({ 客户项目名称: '安吉尔项目', 客户名称: 'casca' }, map), { 客户项目名称: '安吉尔项目' },
    '两列都有值时优先更具体的客户项目名称')
  assert.deepEqual(buildCoverPatch({ 客户项目名称: '', 客户名称: '' }, map), {}, '两列都空 ⇒ 不写')
})

test('带入项数 = 真正有值的格数（界面「已引用…带入 N 项」靠它）', () => {
  const row = { 产品编号: 'A', 产品名称: 'B', 应用场景: 'C' }
  const patch = buildCoverPatch(row, [
    { from: '产品编号' }, { from: '产品名称', to: '名称' }, { from: '应用场景' }, { from: '客户料号' },
  ])
  assert.equal(Object.keys(patch).length, 3)
})

test('脏输入不炸', () => {
  assert.deepEqual(buildCoverPatch(null, null), {})
  assert.deepEqual(buildCoverPatch({ a: '1' }, undefined), {})
  assert.deepEqual(buildCoverPatch({ a: '1' }, [{ from: '' }, null]), {}, '没有来源的映射项直接跳过')
})
