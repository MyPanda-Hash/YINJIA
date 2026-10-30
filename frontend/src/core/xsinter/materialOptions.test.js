/**
 * materialOptions.test.js —— X烧结配方表「物料编号」下拉的候选生成
 *
 * 【用户口径·2026-10-30】
 *   「X烧结配方计算物料编号应该是在下拉的时候能够看到名字，但是选择填写进去的时候就显示编号
 *     就行了，因为后面已经有名称了，重复了」
 *   「这两个的物料的筛选效果要优化好」
 *
 * 所以下拉候选这件事有三个不受组件实现影响的事实，钉在这里：
 *   ① 一条候选必须是**有编码**的档案行（编码才是能录进单据的身份），同编码只留一条；
 *   ② 显示串要能**同时被编号和名称搜到**（el-select 的 filterable 是拿 label 做 includes 的，
 *      所以 label 里必须两样都有）；
 *   ③ 候选**有上限**：生产档案几千行，一次全渲成 el-option 会让下拉卡住；
 *      但"命中几条"必须如实报，否则用户以为搜不到。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { XSINTER_OPTION_CAP, xsinterMaterialOptions } from './materialOptions.js'

const INV = (code, name) => ({ 存货编码: code, 存货名称: name })

test('候选 = 有编码的档案行；同编码只留一条；label 里编号与名称都在（编号/名称都能搜到）', () => {
  const rows = [INV('YJ-YKRS-001', '英克瑞斯椰壳炭(普通)'), INV('YJ-YKRS-001', '英克瑞斯椰壳炭(普通)'), INV('', '没有编码的行'), INV('BK1-D/10', '专用炭X2')]
  const { options, matched } = xsinterMaterialOptions(rows)
  assert.deepEqual(options.map((o) => o.value), ['BK1-D/10', 'YJ-YKRS-001'], '按编号升序，同码去重，无编码的行不进候选')
  assert.equal(matched, 2, 'matched 是去重后的真候选数（不是原始行数）')
  const yk = options.find((o) => o.value === 'YJ-YKRS-001')
  assert.equal(yk.label, 'YJ-YKRS-001 英克瑞斯椰壳炭(普通)', '下拉里要看得见名字')
  assert.equal(yk.name, '英克瑞斯椰壳炭(普通)', '名称单独带一份，选中后回填 物料名称 列用')
})

test('名称缺失/有空格时只留编号，不留尾随空格（定长列尾空格会传染进单据）', () => {
  const { options } = xsinterMaterialOptions([INV('M-001  ', '   '), INV('  M-002', '炭棒  ')])
  assert.deepEqual(options.map((o) => o.label), ['M-001', 'M-002 炭棒'])
  assert.deepEqual(options.map((o) => o.value), ['M-001', 'M-002'])
})

test('候选封顶：超出上限截断，但 matched 报的是截断前的总数', () => {
  const many = Array.from({ length: XSINTER_OPTION_CAP + 37 }, (_, i) => INV(`C-${String(i).padStart(4, '0')}`, `料${i}`))
  const { options, matched } = xsinterMaterialOptions(many)
  assert.equal(options.length, XSINTER_OPTION_CAP, '渲染上限必须生效（几千行档案不许一次性渲成 option）')
  assert.equal(matched, XSINTER_OPTION_CAP + 37, '命中总数要如实报，否则截断看起来像"搜不到"')
  assert.equal(options[0].value, 'C-0000', '截断取排序后的前 N 条，结果稳定可复现')
})

test('自定义上限；脏输入不炸', () => {
  const rows = [INV('A', '甲'), INV('B', '乙'), INV('C', '丙')]
  assert.equal(xsinterMaterialOptions(rows, 2).options.length, 2)
  assert.equal(xsinterMaterialOptions(rows, 2).matched, 3)
  for (const bad of [null, undefined, [], 'nope', 42]) {
    assert.deepEqual(xsinterMaterialOptions(bad), { options: [], matched: 0 }, `${String(bad)} 应该给空候选而不是抛错`)
  }
  assert.equal(xsinterMaterialOptions([INV('A', '甲')], 0).options.length, 1, '非法上限落回默认值（不能截成 0 条）')
})
