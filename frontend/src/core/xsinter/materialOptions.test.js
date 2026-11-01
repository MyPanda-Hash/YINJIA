/**
 * materialOptions.test.js —— X烧结配方表「物料编号」下拉的候选生成
 *
 * 【用户口径·2026-10-30】
 *   「X烧结配方计算物料编号应该是在下拉的时候能够看到名字，但是选择填写进去的时候就显示编号
 *     就行了，因为后面已经有名称了，重复了」
 *   「如果一个种类的物料超过了一页下拉的长度，可以提供切页选项，通过切页来选择，
 *     就不会出现明明有这个物料但是因为下拉框限制找不到」
 *
 * 所以下拉候选这件事有三个不受组件实现影响的事实，钉在这里：
 *   ① 一条候选必须是**有编码**的档案行（编码才是能录进单据的身份），同编码只留一条；
 *   ② 显示串要能**同时被编号和名称搜到**（el-select 的 filterable 是拿 label 做 includes 的，
 *      所以 label 里必须两样都有）；
 *   ③ **一条都不许藏**：这里返回全量（按编号升序），翻页交给 core/ui/selectPage.js。
 *      上一版在这里封顶，第 N+1 条之后的物料在界面上根本不存在 —— 用户会以为档案里没有这个料。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { xsinterMaterialOptions } from './materialOptions.js'
import { slicePage } from '../ui/selectPage.js'

const INV = (code, name) => ({ 存货编码: code, 存货名称: name })

test('候选 = 有编码的档案行；同编码只留一条；label 里编号与名称都在（编号/名称都能搜到）', () => {
  const rows = [INV('YJ-YKRS-001', '英克瑞斯椰壳炭(普通)'), INV('YJ-YKRS-001', '英克瑞斯椰壳炭(普通)'), INV('', '没有编码的行'), INV('BK1-D/10', '专用炭X2')]
  const options = xsinterMaterialOptions(rows)
  assert.deepEqual(options.map((o) => o.value), ['BK1-D/10', 'YJ-YKRS-001'], '按编号升序，同码去重，无编码的行不进候选')
  const yk = options.find((o) => o.value === 'YJ-YKRS-001')
  assert.equal(yk.label, 'YJ-YKRS-001 英克瑞斯椰壳炭(普通)', '下拉里要看得见名字')
  assert.equal(yk.name, '英克瑞斯椰壳炭(普通)', '名称单独带一份，选中后回填 物料名称 列用')
})

test('名称缺失/有空格时只留编号，不留尾随空格（定长列尾空格会传染进单据）', () => {
  const options = xsinterMaterialOptions([INV('M-001  ', '   '), INV('  M-002', '炭棒  ')])
  assert.deepEqual(options.map((o) => o.label), ['M-001', 'M-002 炭棒'])
  assert.deepEqual(options.map((o) => o.value), ['M-001', 'M-002'])
})

test('一共多少条就返回多少条（不封顶）；超出一页的靠翻页拿到，一条都不许藏', () => {
  const many = Array.from({ length: 237 }, (_, i) => INV(`C-${String(i).padStart(4, '0')}`, `料${i}`))
  const options = xsinterMaterialOptions(many)
  assert.equal(options.length, 237, '候选总数必须等于档案里真实条数（上一版封顶 200，第 201 条之后肉眼不可见）')
  // 翻页取第 5 页：必须能拿到 200 号之后的条目
  const p5 = slicePage(options, 5)
  assert.equal(p5.items.length, 37)
  assert.equal(p5.items[0].value, 'C-0200', '第 5 页第一条 = 全量里的第 201 条')
  assert.equal(p5.items[36].value, 'C-0236')
})

test('脏输入不炸', () => {
  for (const bad of [null, undefined, [], 'nope', 42]) {
    assert.deepEqual(xsinterMaterialOptions(bad), [], `${String(bad)} 应该给空候选而不是抛错`)
  }
})
