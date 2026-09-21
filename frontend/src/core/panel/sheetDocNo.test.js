import test from 'node:test'
import assert from 'node:assert/strict'
import { docNoKeyOf } from './sheetDocNo.js'

// 背景(2026-09-21 e2e 探针抓到的真缺陷):
//   纸张右上角「编号：」格的可编辑分支原来写死 v-model="head['文档编号']",
//   而单据类面板(成型工艺清单/组装工艺等)的编号字段是「单据编号」⇒ 编辑期间那格永远空白;
//   只读分支有 `文档编号 || 单据编号` 兜底,所以只有编辑时看得见。

test('单据类面板(只有 单据编号)⇒ 绑 单据编号', () => {
  assert.equal(docNoKeyOf({ 单据编号: 'MP-2026-09-0080', 单据状态: '草稿' }), '单据编号')
})

test('文档类面板(有 文档编号)⇒ 仍绑 文档编号', () => {
  assert.equal(docNoKeyOf({ 文档编号: 'YJ-PD-01', 单据编号: 'X-1' }), '文档编号')
})

test('文档编号键存在但为空串 ⇒ 仍绑 文档编号(键在就以它为准)', () => {
  assert.equal(docNoKeyOf({ 文档编号: '', 单据编号: 'X-1' }), '文档编号')
})

test('head 为空/null 不炸', () => {
  assert.equal(docNoKeyOf({}), '单据编号')
  assert.equal(docNoKeyOf(null), '单据编号')
})
