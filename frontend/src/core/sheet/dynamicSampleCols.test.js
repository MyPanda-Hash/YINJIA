/**
 * dynamicSampleCols 单测 —— 「3.数据记录表」动态样品列**不可被列偏好隐藏**。
 *
 * 【为什么必须自动化守】2026-11-20 生产事故(用户连报两次):数据记录表「功能性滤效」
 * (RD_FILTER_EFF)点右上角「样品列 ＋/－」时,**只有「取样前样品」跟着增删**,
 * 「出水含量（ug/L）」与「去除率%」两组永远只剩样品1。
 *
 * 取证(生产库实测,只读):
 *   yj_field 里 `出水含量（ug/L）样品2..6` / `去除率%样品2..6` 共 10 行
 *   `hidden=1 / visible=0`;而 `压力（PSI)样品1..6`、`流速（L/min)样品1..6` 全是 visible=1。
 *   元数据下发时 `dataName = yj_field.label`、`visible=false` ⇒ 前端 dtHidden() 为真,
 *   三组都是 `v-if="!dtHidden(key)"` ⇒ 那两组只渲染样品1(点 ＋ 也不加列)。
 *   本地库同一批行是 visible=1,所以本地复现不了 —— 病根是**数据脏 + 渲染层无护栏**。
 *
 * 护栏:columnPrefs.isColumnHiddenFor(key, field) 对动态样品列恒返回 false,
 * 组件 dtHidden() 只走它;字段编辑里这些列的显隐开关禁用。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SAMPLE_DETAIL_PREFIXES,
  SAMPLE_SHEET_GROUPS,
  isDynamicSampleKey,
  sampleDetailKeys,
} from './sampleCols.js'
import { isColumnHidden, isColumnHiddenFor } from './columnPrefs.js'

test('三组动态列 = 压力 / 出水含量 / 去除率(顺序即纸面顺序)', () => {
  assert.deepEqual(SAMPLE_SHEET_GROUPS.map((g) => g.name), ['压力', '出水', '去除率'])
  assert.deepEqual(SAMPLE_SHEET_GROUPS.map((g) => g.prefix), [
    '压力（PSI)样品', '出水含量（ug/L）样品', '去除率%样品',
  ])
  // 前缀必须在「按样品铺开的明细字段」单一真源里(减列清空按它走,漏一个就只在减列时暴露)
  for (const g of SAMPLE_SHEET_GROUPS) assert.ok(SAMPLE_DETAIL_PREFIXES.includes(g.prefix))
})

test('动态样品列判据:四个前缀 × 1..6 全部命中', () => {
  for (const prefix of SAMPLE_DETAIL_PREFIXES) {
    for (let n = 1; n <= 6; n++) assert.equal(isDynamicSampleKey(`${prefix}${n}`), true, `${prefix}${n}`)
  }
})

test('动态样品列判据:非样品列 / 非法序号不误判', () => {
  for (const key of [
    '冲水时间', '累计进水（L）', '水温（℃）', '原水含量（ug/L）5号缸', '测试时间',
    '样品信息2', '样品配方3', '测试装置及编号4', // 头字段按样品铺开,但不走本组渲染
    '压力（PSI)样品', '压力（PSI)样品0', '压力（PSI)样品01', '压力（PSI)样品1a',
    '压力（PSI)样品-1', '去除率样品2', '', null, undefined,
  ]) {
    assert.equal(isDynamicSampleKey(key), false, String(key))
  }
})

test('某组样品列键 = 前缀 + 1..count;非法 count 安静返回 []', () => {
  assert.deepEqual(sampleDetailKeys('出水含量（ug/L）样品', 3), [
    '出水含量（ug/L）样品1', '出水含量（ug/L）样品2', '出水含量（ug/L）样品3',
  ])
  assert.deepEqual(sampleDetailKeys('去除率%样品', 1), ['去除率%样品1'])
  for (const bad of [0, -1, undefined, null, NaN, 'x']) assert.deepEqual(sampleDetailKeys('去除率%样品', bad), [])
  assert.deepEqual(sampleDetailKeys('', 3), [])
})

// ⭐ 回归本体:生产库把这两组样品2..6 全标成 visible=false,列数仍必须等于样品数
test('三组列数恒等于样品数(2..6):即使元数据把动态样品列标成 visible=false', () => {
  for (const count of [2, 3, 4, 5, 6]) {
    for (const g of SAMPLE_SHEET_GROUPS) {
      const keys = sampleDetailKeys(g.prefix, count)
      const shown = keys.filter((k) => !isColumnHiddenFor(k, { visible: false }))
      assert.equal(shown.length, count, `${g.name} 组在 样品数=${count} 时应渲染 ${count} 列`)
      assert.equal(shown.length, keys.length)
    }
  }
})

test('护栏只放行动态样品列:普通列 visible=false 仍然隐藏', () => {
  // 先证明桩数据确实会被判隐藏,否则下面的「不隐藏」可能是假绿
  assert.equal(isColumnHidden({ visible: false }), true)
  assert.equal(isColumnHiddenFor('冲水时间', { visible: false }), true)
  assert.equal(isColumnHiddenFor('原水含量（ug/L）5号缸', { visible: false }), true)
  assert.equal(isColumnHiddenFor('样品信息2', { visible: false }), true, '头字段样品信息不归本组管,照旧')
  for (const g of SAMPLE_SHEET_GROUPS) {
    assert.equal(isColumnHiddenFor(`${g.prefix}2`, { visible: false }), false, `${g.name} 样品2 不许被隐藏`)
    assert.equal(isColumnHiddenFor(`${g.prefix}2`, null), false)
  }
})

/** 源码级回归:组件必须经护栏判显隐,字段编辑不许给动态样品列留隐藏开关 */
test('页面接线:DataRecordSheet 的 dtHidden 走 isColumnHiddenFor(不再裸调 isColumnHidden)', () => {
  const sheet = readFileSync(new URL('../views/DataRecordSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /function dtHidden\s*\(\s*key\s*\)\s*\{[\s\S]{0,400}isColumnHiddenFor\s*\(\s*key\s*,/, 'dtHidden 必须经 isColumnHiddenFor 判显隐')
  assert.doesNotMatch(sheet, /function dtHidden\s*\(\s*key\s*\)\s*\{[\s\S]{0,200}[^r]isColumnHidden\s*\(\s*dtFieldOf/, 'dtHidden 不许再裸调 isColumnHidden')
  assert.match(sheet, /SAMPLE_SHEET_GROUPS/, 'DT_GROUPS 必须与 sampleCols 同源(前缀只写一处)')
  assert.match(sheet, /sampleDetailKeys\s*\(\s*prefix\s*,\s*sampleCount\.value\s*\)/, '组内列键按 样品数 取')
})

test('页面接线:字段编辑给动态样品列禁用显隐开关,并恒按显示回显', () => {
  const sheet = readFileSync(new URL('../views/DataRecordSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /const dynamic = isDynamicSampleKey\(col\.key\)/, '字段编辑行要标记动态样品列')
  assert.match(sheet, /const visible = dynamic \? true : !dtHidden\(col\.key\)/, '动态样品列恒回显为显示')
  assert.match(sheet, /:disabled="row\.dynamic"/, '动态样品列的显隐复选框必须禁用')
})

test('页面接线:三组表头/表体都仍按 sampleCount 渲染(加列三组同步)', () => {
  const sheet = readFileSync(new URL('../views/DataRecordSheet.vue', import.meta.url), 'utf8')
  // colgroup: cp / co / cr;表头:hp / ho / hr;表体:dp / do / dr
  const cases = [
    { loopKey: 'co', field: '出水含量（ug/L）样品', what: 'colgroup 出水组' },
    { loopKey: 'cr', field: '去除率%样品', what: 'colgroup 去除率组' },
    { loopKey: 'ho', field: '出水含量（ug/L）样品', what: '表头出水组' },
    { loopKey: 'hr', field: '去除率%样品', what: '表头去除率组' },
    { loopKey: 'do', field: '出水含量（ug/L）样品', what: '表体出水组' },
    { loopKey: 'dr', field: '去除率%样品', what: '表体去除率组' },
  ]
  for (const { loopKey, field, what } of cases) {
    const re = new RegExp(
      `v-for="n in sampleCount" :key="'${loopKey}' \\+ n"[\\s\\S]{0,260}${field}\\$\\{n\\}`,
    )
    assert.match(sheet, re, `${what}必须跟着 sampleCount 增删`)
  }
})
