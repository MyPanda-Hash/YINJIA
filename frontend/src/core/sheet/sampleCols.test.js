/**
 * sampleCols 单测 —— 数据记录表「动态样品列」的字段名单一真源。
 *
 * 【这条为什么必须自动化守】2026-09-30 用户报「功能性滤效的样品配方列数应该跟样品信息同步」:
 *   样品配方 原来是一个**单字段**(纸面一格跨全部样品列),而设计原表里它是**每样品一格**
 *   (《数据记录表.xlsx》sheet 功能性滤效 第 10 行 merges C10:G10 + H10:L10,与第 11 行
 *    样品信息 C11:G11 + H11:L11 同一分块)。加列时它不跟着分裂,减列时它也不清空。
 *
 * 通病在于「哪些字段是按样品铺开的」散落在组件里:漏登记一个前缀 → 加/减样品列时只有那一格
 * 不动,而且要等到**用户减列**才暴露。这里集中成常量 + 纯函数,由单测钉死。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SAMPLE_HEAD_PREFIXES,
  SAMPLE_DETAIL_PREFIXES,
  sampleHeadKey,
  clearSampleColumn,
} from './sampleCols.js'

test('按样品铺开的头字段前缀含 样品信息 / 测试装置及编号 / 样品配方(每样品一格)', () => {
  assert.deepEqual(SAMPLE_HEAD_PREFIXES, ['样品信息', '测试装置及编号', '样品配方'])
})

test('按样品铺开的明细字段前缀 = 3.数据记录表的三组(压力/流速 · 出水含量 · 去除率)', () => {
  assert.deepEqual(SAMPLE_DETAIL_PREFIXES, [
    '压力（PSI)样品', '流速（L/min)样品', '出水含量（ug/L）样品', '去除率%样品',
  ])
})

test('字段名 = 前缀 + 序号(与 yj_field.label 同名)', () => {
  assert.equal(sampleHeadKey('样品配方', 3), '样品配方3')
  assert.equal(sampleHeadKey('样品信息', 1), '样品信息1')
})

test('减列清空:头字段与明细行**每一处**按样品铺开的字段都被清空(含 样品配方N)', () => {
  const head = {
    样品信息3: '样品3：密度0.6',
    样品配方3: 'A料 30% / B料 70%',
    测试装置及编号3: '滤效实验室5#',
    样品信息2: '第二列不动',
    样品配方2: '第二列配方不动',
    detail: { items: [
      { '压力（PSI)样品3': '135', '流速（L/min)样品3': '1.9', '出水含量（ug/L）样品3': '12', '去除率%样品3': '96', '压力（PSI)样品2': '122' },
      { '压力（PSI)样品3': '140', '出水含量（ug/L）样品3': '15' },
    ] },
  }
  const cleared = clearSampleColumn(head, 3)
  // 头字段:三个前缀都要清
  for (const k of ['样品信息3', '样品配方3', '测试装置及编号3']) assert.equal(head[k], '', `${k} 应被清空`)
  // 明细行:每一行、每个按样品铺开的字段都要清
  for (const row of head.detail.items) {
    for (const k of ['压力（PSI)样品3', '流速（L/min)样品3', '出水含量（ug/L）样品3', '去除率%样品3']) {
      if (row[k] !== undefined) assert.equal(row[k], '', `${k} 应被清空`)
    }
  }  // 别的样品列一格都不许动
  assert.equal(head['样品信息2'], '第二列不动')
  assert.equal(head['样品配方2'], '第二列配方不动')
  assert.equal(head.detail.items[0]['压力（PSI)样品2'], '122')
  // 返回清单:三个头字段 + 2 行 × 4 组
  assert.equal(cleared.filter((k) => !k.startsWith('压力') && !k.startsWith('流速') && !k.startsWith('出水') && !k.startsWith('去除')).length, 3)
})

test('减列清空:明细为空 / 没有该列数据时不报错(减列是常态操作)', () => {
  assert.doesNotThrow(() => clearSampleColumn({}, 6))
  assert.doesNotThrow(() => clearSampleColumn({ detail: { items: [] } }, 2))
  assert.doesNotThrow(() => clearSampleColumn(null, 2))
  assert.deepEqual(clearSampleColumn(null, 2), [])
})

test('减列清空:样品序号非法(0/空/非数字)时不动作', () => {
  const head = { 样品信息1: 'x', 样品配方1: 'y' }
  assert.deepEqual(clearSampleColumn(head, 0), [])
  assert.deepEqual(clearSampleColumn(head, undefined), [])
  assert.equal(head['样品信息1'], 'x')
  assert.equal(head['样品配方1'], 'y')
})
