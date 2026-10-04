import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carryKeyOf,
  carryEntriesOf,
  missingCarryRows,
  carryPlan,
} from './qcInspReqCarry.js'
import { lookupReqGroups } from './qcInspReqLookup.js'

/** PP管 YJ-JB-001(库里真行的形状:只有 长/内径/外径 三列有数据,其余列全空) */
const JB_ROW = {
  id: 30,
  物料类别: 'PP管',
  物料编号: 'YJ-JB-001',
  长: '274.5±0.5',
  内径: '6±0.2',
  外径: '8.1±0.1',
  '脏污、头发丝': null,
  '破损、切斜': '',
}

const TS_ROW = {
  id: 31,
  物料类别: 'PP棉',
  物料编号: 'YJ-TS-001',
  尺寸: '65*49*284.5',
}

test('carryKeyOf:去掉所有空白后比 —— 排版差异不算两项', () => {
  assert.equal(carryKeyOf(' 外径 '), '外径')
  assert.equal(carryKeyOf('外径 1'), carryKeyOf('外径1'))
  assert.equal(carryKeyOf(null), '')
})

test('检验项=表头列名;检测标准=命中行的数据(空数据列不成项)', () => {
  const entries = carryEntriesOf(lookupReqGroups([JB_ROW], 'YJ-JB-001'))
  assert.deepEqual(entries, [
    { 检验项: '长', 检测标准: '274.5±0.5' },
    { 检验项: '内径', 检测标准: '6±0.2' },
    { 检验项: '外径', 检测标准: '8.1±0.1' },
  ], '空着的 脏污、头发丝 / 破损、切斜 不带进来')
})

test('顺序 = 页签配置的列序(Excel 原列序),不是数据的键序', () => {
  // 故意把对象键序打乱:长 放最后,输出仍按 PP管 配置序(长/内径/外径)
  const scrambled = { 外径: '8.1±0.1', 内径: '6±0.2', id: 1, 物料编号: 'YJ-JB-001', 物料类别: 'PP管', 长: '274.5±0.5' }
  assert.deepEqual(
    carryEntriesOf(lookupReqGroups([scrambled], 'YJ-JB-001')).map((e) => e.检验项),
    ['长', '内径', '外径'],
  )
})

test('标识列不进检验项(物料编号/物料类别/id 永不成为检验项)', () => {
  const items = carryEntriesOf(lookupReqGroups([JB_ROW, TS_ROW], 'YJ-JB-001')).map((e) => e.检验项)
  assert.ok(!items.includes('物料编号'))
  assert.ok(!items.includes('物料类别'))
  assert.ok(!items.includes('id'))
})

test('只补缺失项:已有的检验项保留(检测结果/判定不动),缺的按来料检验要求顺序补', () => {
  const entries = carryEntriesOf(lookupReqGroups([JB_ROW], 'YJ-JB-001'))
  const existing = [
    { 检验项: '内径', 检测标准: '6±0.2', 检测结果: '合格', 单项判定: '合格' },
    { 检验项: '外观', 检测标准: '无脏污' }, // 要求表里没有的项,照样保留
  ]
  const add = missingCarryRows(existing, entries)
  assert.deepEqual(add, [
    { 检验项: '长', 检测标准: '274.5±0.5' },
    { 检验项: '外径', 检测标准: '8.1±0.1' },
  ])
  // 已有的那行一个字段都没被改动
  assert.equal(existing[0].检测标准, '6±0.2')
  assert.equal(existing[0].检测结果, '合格')
})

test('幂等:补过一遍之后再点带入,一行都不加', () => {
  const plan1 = carryPlan([JB_ROW], 'YJ-JB-001', [])
  assert.equal(plan1.add.length, 3)
  const after = plan1.add.map((r) => ({ ...r, 检测结果: '合格' })) // 已录入结果
  const plan2 = carryPlan([JB_ROW], 'YJ-JB-001', after)
  assert.deepEqual(plan2.add, [])
  assert.equal(plan2.entries.length, 3, '条目本身照旧全量给出(供界面提示用)')
})

test('同名项去重:空格差异只带一次,取首个非空数据', () => {
  const rows = [
    { id: 1, 物料类别: '垫片', 物料编号: 'M1', 外径: '10±0.1' },
    { id: 2, 物料类别: '垫片', 物料编号: 'M1', 外径: '11±0.1', 内径: '5±0.1' },
  ]
  const entries = carryEntriesOf(lookupReqGroups(rows, 'M1'))
  assert.deepEqual(entries.map((e) => `${e.检验项}=${e.检测标准}`), ['外径=10±0.1', '内径=5±0.1'], '取首行非空数据')
})

test('没命中 / 物料编码为空 ⇒ 无可带入项(不报错)', () => {
  assert.deepEqual(carryEntriesOf(lookupReqGroups([JB_ROW], '不存在的编号')), [])
  assert.deepEqual(carryEntriesOf(lookupReqGroups([JB_ROW], '')), [])
  assert.deepEqual(carryEntriesOf(null), [])
  assert.deepEqual(missingCarryRows(null, null), [])
})

test('配置外物料类别不静默丢数据:兜底按行键序带入(排掉 id/asp_* 审计列)', () => {
  const rows = [{ id: 9, 物料类别: '外星料', 物料编号: 'M9', asp_user1: '张三', 规格X: '1.5', 备注X: 'ok' }]
  const entries = carryEntriesOf(lookupReqGroups(rows, 'M9'))
  assert.deepEqual(entries, [{ 检验项: '规格X', 检测标准: '1.5' }, { 检验项: '备注X', 检测标准: 'ok' }])
})

/** 源码级回归:检验报告必须挂带入入口,且带入算法只此一份(不各写一遍合并逻辑) */
test('页面接线:检验报告有「带入检验要求」入口,且走 qcInspReqCarry', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /@core\/qc\/qcInspReqCarry/, '必须引用带入纯逻辑模块')
  assert.match(src, /carryPlan\(/, '必须用 carryPlan 算该补的行')
  assert.match(src, /tt\('带入检验要求'\)/, '要有「带入检验要求」入口')
})
