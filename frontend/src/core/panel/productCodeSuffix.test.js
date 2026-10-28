import test from 'node:test'
import assert from 'node:assert/strict'
import { productCodeWithSuffix, rawProductCode, usesProductCodeSuffix, TB_SUFFIX } from './productCodeSuffix.js'

/**
 * 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #2):
 *   「【成型工艺清单页】点击选择产品编号之后,在产品编号后面自动添加 -tb 编号后缀」
 *   + 「加在产品编号本身」。
 *
 * 这组断言钉住三条**错了不会报错、只会静默查不到**的规则:
 *   ① 只有成型工艺清单加,其它面板原样;
 *   ② 幂等(重复选参照不叠成 -tb-tb);
 *   ③ 空值不产出只有后缀的脏值。
 * 另钉「历史单据兼容」:rawProductCode 必须能把新老两种形态都还原成同一个原始编号 ——
 * 它是所有"按产品编号反查"的唯一入口,剥不干净就会查不到老单。
 */

test('① 只有成型工艺清单加 -tb,其它面板原样返回', () => {
  assert.equal(productCodeWithSuffix('00011', 'RD_MOLD_PROC'), '00011-tb')
  // 没有这条口径的面板:一个字符都不许变
  for (const p of ['RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN', 'RD_PROD_INFO', '', null, undefined]) {
    assert.equal(productCodeWithSuffix('00011', p), '00011', `面板 ${p} 不该加后缀`)
  }
  assert.equal(usesProductCodeSuffix('RD_MOLD_PROC'), true)
  assert.equal(usesProductCodeSuffix('RD_ASM_PROC'), false)
})

test('② 幂等:已经带 -tb 的不再叠加(重复点参照同一行)', () => {
  const once = productCodeWithSuffix('00011', 'RD_MOLD_PROC')
  assert.equal(once, '00011-tb')
  const twice = productCodeWithSuffix(once, 'RD_MOLD_PROC')
  assert.equal(twice, '00011-tb', '重复选择不能变成 00011-tb-tb')
  const thrice = productCodeWithSuffix(twice, 'RD_MOLD_PROC')
  assert.equal(thrice, '00011-tb')
})

test('②b 大小写/空格容错:已存的 -TB 或带空格的也不叠', () => {
  assert.equal(productCodeWithSuffix(' 00011-TB ', 'RD_MOLD_PROC'), '00011-tb')
  assert.equal(rawProductCode('  00011-tb  '), '00011')
  assert.equal(rawProductCode('00011-TB'), '00011')
})

test('③ 空值不加工:绝不产出只有后缀的脏值 -tb', () => {
  for (const v of ['', '   ', null, undefined]) {
    assert.equal(productCodeWithSuffix(v, 'RD_MOLD_PROC'), '', `空值 ${JSON.stringify(v)} 应返回空串`)
    assert.equal(rawProductCode(v), '')
  }
})

test('④ 历史单据兼容:新老两种形态都还原成同一个原始编号', () => {
  // 老单(本功能上线前保存的):没有后缀
  assert.equal(rawProductCode('00011'), '00011')
  // 新单:带后缀
  assert.equal(rawProductCode('00011-tb'), '00011')
  // 两者还原结果必须一致 —— 后端按原始编号反查才不会只认一半
  assert.equal(rawProductCode('00011'), rawProductCode(productCodeWithSuffix('00011', 'RD_MOLD_PROC')))
})

test('⑤ 只在结尾剥:业务编码中间含 -tb 的字样不受影响', () => {
  // 例:客户料号风格编码中间带 tb 字样;只有结尾那层才是我们的后缀
  assert.equal(rawProductCode('AB-tb-CD'), 'AB-tb-CD')
  assert.equal(productCodeWithSuffix('AB-tb-CD', 'RD_MOLD_PROC'), 'AB-tb-CD-tb')
  assert.equal(rawProductCode('AB-tb-CD-tb'), 'AB-tb-CD')
})

test('⑥ 后缀常量与用户口径逐字一致(小写 -tb)', () => {
  assert.equal(TB_SUFFIX, '-tb')
})
