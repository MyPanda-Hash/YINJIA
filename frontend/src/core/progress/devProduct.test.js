import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCarbonSize, productsOfKey, devSummaryOf, prefillProduct } from './devProduct.js'

/** 用户口径(2026-10-16):一个立项可以开发好几个产品(产品编号各不相同);
 *  「开发产品」按项目带出产品信息表数据 —— 规格→产品整体尺寸/炭棒尺寸、项目名称→客户项目名称。 */

test('parseCarbonSize:三种常见写法都认得出 外径/内径/长度', () => {
  assert.deepEqual(parseCarbonSize('φ33×12×110mm'), { 外径: '33', 内径: '12', 长度: '110' })
  assert.deepEqual(parseCarbonSize('33*12*110'), { 外径: '33', 内径: '12', 长度: '110' })
  assert.deepEqual(parseCarbonSize('外径33 内径12 长度110'), { 外径: '33', 内径: '12', 长度: '110' })
  assert.deepEqual(parseCarbonSize('φ33.5×12.5×110.5'), { 外径: '33.5', 内径: '12.5', 长度: '110.5' })
})

test('parseCarbonSize:认不出就返回 null(不瞎猜数字)', () => {
  assert.equal(parseCarbonSize('φ33×110mm'), null)      // 只有两个数
  assert.equal(parseCarbonSize('特殊结构:带端盖'), null)
  assert.equal(parseCarbonSize(''), null)
  assert.equal(parseCarbonSize(null), null)
})

test('productsOfKey:按立项文档编号配对,空键不误配', () => {
  const ps = [
    { 产品编号: 'A', 立项文档编号: 'P-1' },
    { 产品编号: 'B', 立项文档编号: 'P-2' },
    { 产品编号: 'C', 立项文档编号: ' P-1 ' },
    { 产品编号: 'D', 立项文档编号: '' },
  ]
  assert.deepEqual(productsOfKey(ps, 'P-1').map((p) => p['产品编号']), ['A', 'C'])
  assert.deepEqual(productsOfKey(ps, 'P-2').map((p) => p['产品编号']), ['B'])
  assert.deepEqual(productsOfKey(ps, ''), [], '空键不得把"没有项目"的产品全捞出来')
  assert.deepEqual(productsOfKey(null, 'P-1'), [])
})

test('devSummaryOf:节点计到所有产品上,全部归档才算"已全部开发完毕"', () => {
  const one = (code, done, all) => ({ 产品编号: code, doneCount: done, allDone: all, nodes: [{}, {}, {}, {}] })
  assert.deepEqual(devSummaryOf([]), { count: 0, nodes: 0, done: 0, allDone: false })
  assert.deepEqual(devSummaryOf([one('A', 2, false)]), { count: 1, nodes: 4, done: 2, allDone: false })
  assert.deepEqual(devSummaryOf([one('A', 4, true), one('B', 2, false)]), { count: 2, nodes: 8, done: 6, allDone: false })
  assert.deepEqual(devSummaryOf([one('A', 4, true), one('B', 4, true)]), { count: 2, nodes: 8, done: 8, allDone: true })
})

test('prefillProduct:项目名称→客户项目名称;规格→整体尺寸 + 炭棒三格;带关联键与负责人', () => {
  const fd = prefillProduct({ code: 'CB-YL-002', name: '二代', projectKey: 'YJ-PD-2026-001', projectName: '除余氯炭棒(测试)', spec: 'φ33×12×110mm', owner: 'cp' })
  assert.equal(fd['立项文档编号'], 'YJ-PD-2026-001', '关联键必须带上,否则下游配不上项目')
  assert.equal(fd['产品编号'], 'CB-YL-002')
  assert.equal(fd['客户项目名称'], '除余氯炭棒(测试)')
  assert.equal(fd['产品整体尺寸'], 'φ33×12×110mm')
  assert.equal(fd['炭棒外径'], '33')
  assert.equal(fd['炭棒内径'], '12')
  assert.equal(fd['炭棒长度'], '110')
  assert.equal(fd['产品负责人'], 'cp')
})

test('prefillProduct:规格认不出时只填整体尺寸,不写炭棒三格;没负责人就不写该键', () => {
  const fd = prefillProduct({ code: 'X', projectKey: 'P', projectName: 'N', spec: '带端盖结构' })
  assert.equal(fd['产品整体尺寸'], '带端盖结构')
  assert.ok(!('炭棒外径' in fd) && !('炭棒内径' in fd) && !('炭棒长度' in fd), '认不出就不该猜三个数字')
  assert.ok(!('产品负责人' in fd))
  assert.equal(fd['产品名称'], '')
})
