/**
 * ledgerCols 单测 —— 只读台账页(pages[i].ledger)的取值规则。
 *
 * 【为什么必须钉死】台账「委托测试汇总表」列的是**全量单据**的表头摘要,而各面板的键名并不统一:
 *   单号有 单据编号 / 编号 / 单号 三种,日期有 单据日期 / 日期 两种。
 * 取值写成单键立刻整列空白(且台账是派生视图,没人会发现"少了哪张单"),故按序回退 + 空串兜底两条都要钉。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ledgerCell } from './ledgerCols.js'

test('seq 列显示行号(1 起),与单据里的序号无关', () => {
  assert.equal(ledgerCell({ label: '序号', seq: true }, { 序号: '99' }, 0), '1')
  assert.equal(ledgerCell({ label: '序号', seq: true }, { 序号: '99' }, 4), '5')
})

test('keys 按序回退取第一个非空键(单据编号 → 编号 → 单号)', () => {
  const col = { label: '表格编号', keys: ['单据编号', '编号', '单号'] }
  assert.equal(ledgerCell(col, { 单据编号: 'DT2026-001' }, 0), 'DT2026-001')
  assert.equal(ledgerCell(col, { 编号: 'DT2026-002' }, 0), 'DT2026-002')
  assert.equal(ledgerCell(col, { 单号: 'DT2026-003' }, 0), 'DT2026-003')
  // 前面的键为空串/空白 ⇒ 继续往后回退(空串不算命中)
  assert.equal(ledgerCell(col, { 单据编号: '  ', 编号: 'DT2026-004' }, 0), 'DT2026-004')
})

test('key 单键取值;取不到返回空串而不是 undefined', () => {
  assert.equal(ledgerCell({ label: '分类', key: '申请单类型' }, { 申请单类型: '销售端' }, 0), '销售端')
  assert.equal(ledgerCell({ label: '状态', keys: ['单据状态'] }, {}, 0), '')
  assert.equal(ledgerCell({ label: '状态', keys: ['单据状态'] }, null, 0), '')
})

test('detailKeys:表头上没有的列退到明细第一行取(设计的发起人 = 明细的 申请人/发起人)', () => {
  const col = { label: '发起人', keys: ['申请人', '发起人'], detailKeys: ['申请人', '发起人'] }
  // 内部页的明细列叫 申请人,外部页叫 发起人 —— 两种都要取得到
  assert.equal(ledgerCell(col, { detail: { items: [{ 申请人: '张三' }] } }, 0), '张三')
  assert.equal(ledgerCell(col, { detail: { items: [{ 发起人: '李四' }] } }, 0), '李四')
  // 表头有同名键时以表头为准(不回退)
  assert.equal(ledgerCell(col, { 申请人: '王五', detail: { items: [{ 申请人: '张三' }] } }, 0), '王五')
  // 明细为空/无 detail 键 ⇒ 空串(不抛错)
  assert.equal(ledgerCell(col, { detail: { items: [] } }, 0), '')
  assert.equal(ledgerCell(col, {}, 0), '')
})

test('map 做显示映射(申请单类型 → 分类 内部/外部)', () => {
  const col = { label: '分类', key: '申请单类型', map: { 内部委托: '内部', 销售端: '外部' } }
  assert.equal(ledgerCell(col, { 申请单类型: '内部委托' }, 0), '内部')
  assert.equal(ledgerCell(col, { 申请单类型: '销售端' }, 0), '外部')
})

test('map 未登记的取值原样显示(映射表陈旧时不吞值)', () => {
  const col = { label: '分类', key: '申请单类型', map: { 内部委托: '内部' } }
  assert.equal(ledgerCell(col, { 申请单类型: '开发性' }, 0), '开发性')
  // 空值不参与映射(避免把空串映射成别的文本)
  assert.equal(ledgerCell(col, { 申请单类型: '' }, 0), '')
})

test('列配置缺失时返回空串(不抛错 —— 台账取数失败要留空表而不是白屏)', () => {
  assert.equal(ledgerCell(null, { 单据编号: 'X' }, 0), '')
  assert.equal(ledgerCell(undefined, {}, 0), '')
})
