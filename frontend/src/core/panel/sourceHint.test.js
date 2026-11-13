import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceHintOf, sourceHintText, sourceHintTitle, hasHiddenSourceColumn } from './sourceHint.js'

/**
 * 采购入库单表头「来源」提示(2026-11-11,用户口径第三版:
 * 「跳转到的是什么面版的界面,不需要跳转」「为什么之前的单据就没有来源了(主要是想要知道来源来区分不同的入库)」)。
 *
 * 钉三件事:
 *   ① 三来源链路(暂收 / 检验 / 特采)带得出类型 + 单号;
 *   ② 没有上游单据的老单(早期直接录入 / ERP 单号形态)**显示「无上游单据」**,不是空着 ——
 *      用户要的是"用来源区分不同入库",空白会让人以为数据坏了;
 *   ③ 只在「来源是隐藏列」的面板挂提示(采购入库单),`来源` 本是可见字段的面板(ASM_BOM)不重复挂。
 */

const t = (s) => s // 中文环境:翻译就是原文

test('检验入库:类型 + 单号', () => {
  assert.deepEqual(sourceHintOf({ 来源: '来料检验单', 来源单号: 'IJ-2026-10-0064' }),
    { type: '来料检验单', docNo: 'IJ-2026-10-0064', empty: false })
})

test('暂收直达 / 特采入库同样带得出', () => {
  assert.deepEqual(sourceHintOf({ 来源: '送料暂收单', 来源单号: 'SL-2026-10-0119' }),
    { type: '送料暂收单', docNo: 'SL-2026-10-0119', empty: false })
  assert.equal(sourceHintOf({ 来源: '特采单', 来源单号: 'TC-2026-10-0012' }).type, '特采单')
})

test('两列都空 ⇒ empty=true(界面显示「无上游单据」)', () => {
  assert.equal(sourceHintOf({}).empty, true)
  assert.equal(sourceHintOf(null).empty, true)
  assert.equal(sourceHintOf({ 来源: '  ', 来源单号: '' }).empty, true)
})

test('两侧空格不影响取值', () => {
  const h = sourceHintOf({ 来源: '  来料检验单 ', 来源单号: ' IJ-1 ' })
  assert.deepEqual(h, { type: '来料检验单', docNo: 'IJ-1', empty: false })
})

test('提示正文:有来源 / 无上游单据', () => {
  assert.equal(sourceHintText({ type: '来料检验单', docNo: 'IJ-1', empty: false }, t), '来源: 来料检验单 IJ-1')
  assert.equal(sourceHintText({ type: '', docNo: 'SL-9', empty: false }, t), '来源: SL-9')
  assert.equal(sourceHintText(sourceHintOf({}), t), '来源: 无上游单据')
})

test('悬停说明:不再出现「点击打开」(第三版不跳转)', () => {
  assert.equal(sourceHintTitle({ type: '来料检验单', docNo: 'IJ-1', empty: false }, t), '来料检验单: IJ-1')
  assert.equal(sourceHintTitle(sourceHintOf({}), t), '没有暂收/检验/特采上游单据(早期直接录入或 ERP 单号形态的老单)')
  assert.ok(!sourceHintTitle({ type: '特采单', docNo: 'TC-1', empty: false }, t).includes('点击'))
})

test('只在「来源是隐藏列」的面板挂提示', () => {
  // 采购入库单:来源列 hidden(列表页 dataSchema.fields 用 dataName,表单页 meta 用 code)
  assert.equal(hasHiddenSourceColumn([{ dataName: '来源', hidden: true }]), true)
  assert.equal(hasHiddenSourceColumn([{ code: '来源', hidden: true }]), true)
  // ASM_BOM 的「来源」是可见字段:不该再挂一条同样的提示
  assert.equal(hasHiddenSourceColumn([{ dataName: '来源', hidden: false }]), false)
  assert.equal(hasHiddenSourceColumn([{ dataName: '来源' }]), false)
  assert.equal(hasHiddenSourceColumn([]), false)
  assert.equal(hasHiddenSourceColumn(null), false)
})
