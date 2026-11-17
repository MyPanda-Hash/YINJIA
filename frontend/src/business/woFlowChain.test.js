import test from 'node:test'
import assert from 'node:assert/strict'
import { flowChainTip } from './woFlowChain.js'

// 2026-11-14 用户口径:「删除掉这个工序流转明细,这个作用不明显还很丑,除非有其他方法」
//   ⇒ 展开区 8 列大表删除,信息收进「当前工序」格的悬停提示(本文件的纯函数)。
//   这里守的是提示文本的三条口径:当前工序带 ▶、深链定位工序带 ★、待流入量 0 不占位。

const steps = [
  { 工序: '成型', 换算率: 0.5, 计划量: 25, 可加工量: 25, 已审完工: 25, 待报量: 0, 待流入量: 0, 当前: false },
  { 工序: '装箱', 换算率: 1, 计划量: 50, 可加工量: 0, 已审完工: 0, 待报量: 0, 待流入量: 50, 当前: true },
]

test('flowChainTip:一行一道工序,当前工序带 ▶,待流入量 0 不显示', () => {
  const tip = flowChainTip(steps)
  const lines = tip.split('\n')
  assert.equal(lines.length, 2)
  assert.ok(lines[0].startsWith('成型 '), '首道不是当前工序,不加标记')
  assert.ok(lines[0].includes('计划量 25') && lines[0].includes('已审完工 25') && lines[0].includes('可加工量 25'))
  assert.ok(!lines[0].includes('待流入量'), '待流入量 0 不占提示宽度')
  assert.ok(lines[1].startsWith('▶ 装箱 '), '当前工序标 ▶')
  assert.ok(lines[1].includes('待流入量 50'))
})

test('flowChainTip:深链定位的工序标 ★(压过 ▶)', () => {
  const tip = flowChainTip(steps, { focusOp: '装箱' })
  const lines = tip.split('\n')
  assert.ok(lines[1].startsWith('★ 装箱 '), '定位工序用 ★,不再用 ▶')
  assert.ok(lines[0].startsWith('成型 '))
})

test('flowChainTip:没有工序台账(没预排产)返回空串 ⇒ title 为空不弹提示', () => {
  assert.equal(flowChainTip([]), '')
  assert.equal(flowChainTip(null), '')
  assert.equal(flowChainTip(undefined), '')
})

test('flowChainTip:空数量走调用方 fmt(与表格列的 - 同口径),词条走 t()', () => {
  const tip = flowChainTip([{ 工序: '成型', 计划量: null, 已审完工: '', 可加工量: undefined }], {
    t: (s) => `T(${s})`,
    fmt: (v) => (v === null || v === undefined || v === '' ? '-' : String(v)),
  })
  assert.equal(tip, 'T(成型) · T(计划量) - · T(已审完工) - · T(可加工量) -')
})
