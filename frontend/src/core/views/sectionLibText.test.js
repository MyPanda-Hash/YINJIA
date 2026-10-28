import test from 'node:test'
import assert from 'node:assert/strict'
import { sectionLibText, stripSeq } from './sectionLibText.js'

/**
 * 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #5):
 *   「章节标准库·配料要求:支持多行同步填入文本框,多行填充时赋予序号」
 *
 * 这组断言钉住三件**贴进去看着对、其实坏了**的事:
 *   ① 条目自带序号时不能补成 `1. 1. 称料`;
 *   ② 空行不能占号(否则纸面上出现一行孤零零的 `4.`);
 *   ③ 换行符混杂(\r\n / \r / \n)时行数不能算错。
 * 另钉一条真实存在的误伤风险:「100%炭粉」的 100 不是序号。
 */

test('① 多行条目:每行补序号,行数不变', () => {
  const src = '称料\n混合\n加胶\n过筛'
  assert.equal(sectionLibText(src), '1. 称料\n2. 混合\n3. 加胶\n4. 过筛')
})

test('② 条目已自带序号时不重复补(不许出现 1. 1.)', () => {
  const src = '1. 称料\n2. 混合\n3. 加胶'
  const out = sectionLibText(src)
  assert.equal(out, '1. 称料\n2. 混合\n3. 加胶')
  assert.ok(!out.includes('1. 1.'), '不能补成双层序号')
})

test('③ 空行不占号:中间/末尾的空行都不产出孤立的 "n." 行', () => {
  const src = '称料\n\n混合\n\n\n过筛\n'
  assert.equal(sectionLibText(src), '1. 称料\n2. 混合\n3. 过筛')
  const lines = sectionLibText(src).split('\n')
  for (const l of lines) assert.match(l, /^\d+\. \S/, `出现了空序号行: "${l}"`)
})

test('④ 换行符混杂(\r\n / \r / \n)时行数一致', () => {
  const a = sectionLibText('称料\r\n混合\r\n过筛')
  const b = sectionLibText('称料\r混合\r过筛')
  const c = sectionLibText('称料\n混合\n过筛')
  assert.equal(a, c, '\\r\\n 应与 \\n 结果一致')
  assert.equal(b, c, '裸 \\r 应与 \\n 结果一致')
  assert.equal(a.split('\n').length, 3)
})

test('⑤ 单行条目也补序号(同一字段不出现两种排版)', () => {
  assert.equal(sectionLibText('按配方称料'), '1. 按配方称料')
})

test('⑥ 空内容返回空串,不产出 "1. " 这种半截值', () => {
  for (const v of ['', '   ', '\n\n', null, undefined]) {
    assert.equal(sectionLibText(v), '', `空值 ${JSON.stringify(v)} 应返回空串`)
  }
})

test('⑦ 序号剥离认得常见写法,但不会误伤数字开头的正文', () => {
  // 该剥的
  assert.equal(stripSeq('1. 称料'), '称料')
  assert.equal(stripSeq('1、称料'), '称料')
  assert.equal(stripSeq('1) 称料'), '称料')
  assert.equal(stripSeq('(1) 称料'), '称料')
  assert.equal(stripSeq('（1）称料'), '称料')
  assert.equal(stripSeq('一、称料'), '称料')
  // 不该剥的:数字后面没有分隔符 ⇒ 是正文
  assert.equal(stripSeq('100%炭粉'), '100%炭粉')
  assert.equal(stripSeq('20分钟'), '20分钟')
  // 没有序号的原样
  assert.equal(stripSeq('称料'), '称料')
})

test('⑧ 幂等:对已排版结果再跑一次,结果不变(重复点「填入」不会叠号)', () => {
  const once = sectionLibText('称料\n混合\n过筛')
  const twice = sectionLibText(once)
  assert.equal(twice, once)
})
