import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carryKeyOf,
  carryEntriesOf,
  missingCarryRows,
  carryPlan,
  carryHeadOf,
  CARRY_HEAD_KEYS,
} from './qcInspReqCarry.js'
import { lookupReqGroups } from './qcInspReqLookup.js'
import { qcInspReqTabs } from '../views/qcInspReqConfig.js'

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

test('文件编码/检验依据只进抬头,不成检验项(表体里不该有「检验项=文件编码」)', () => {
  const rows = [{
    id: 1, 物料类别: '折叠棉', 物料编号: 'M-4',
    文件编码: 'YJ-QR-96', 检验依据: 'YJ-Q-30', 折叠棉: '47*34*154-1',
  }]
  const plan = carryPlan(rows, 'M-4', [])
  assert.deepEqual(plan.entries.map((e) => e.检验项), ['折叠棉'], '只带真正的检验项')
  assert.deepEqual(plan.head, { 文件编码: 'YJ-QR-96', 检验依据: 'YJ-Q-30' }, '这两项进抬头')
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

/* ── 抬头两项:文件编码/检验依据(2026-10-04 用户口径「靠物料编码对应填入,并且不可以修改」)── */
test('抬头带入键就是这两项', () => {
  assert.deepEqual([...CARRY_HEAD_KEYS], ['文件编码', '检验依据'])
})

test('抬头带入:取命中行首个非空值;没填的项不返回(调用方保留报告原值/默认)', () => {
  const rows = [
    { id: 2, 物料类别: '折叠棉', 物料编号: 'M-1', 文件编码: '', 检验依据: 'YJ-Q-30' },
    { id: 9, 物料类别: '折叠棉', 物料编号: 'M-1', 文件编码: 'YJ-QR-96', 检验依据: 'YJ-Q-31' },
  ]
  const groups = lookupReqGroups(rows, 'M-1')
  assert.deepEqual(carryHeadOf(groups), { 检验依据: 'YJ-Q-30', 文件编码: 'YJ-QR-96' },
    '按 id 升序逐行取首个非空:文件编码跳过空值取 YJ-QR-96,检验依据取第一行')
  const plan = carryPlan(rows, 'M-1', [])
  assert.deepEqual(plan.head, { 检验依据: 'YJ-Q-30', 文件编码: 'YJ-QR-96' })
})

test('抬头带入:两个面板都有命中时,按页签全集顺序取首个非空', () => {
  const rows = [
    { id: 1, 物料类别: '阻垢系列', 物料编号: 'M-2', 文件编码: 'SER-01' },
    { id: 2, 物料类别: '折叠棉', 物料编号: 'M-2', 检验依据: 'YJ-Q-30' },
  ]
  const tabs = [...qcInspReqTabs, { key: '阻垢系列', sheetTitle: '阻垢系列', dynamicCols: true, cols: [] }]
  const plan = carryPlan(rows, 'M-2', [], [], tabs)
  assert.deepEqual(plan.head, { 文件编码: 'SER-01', 检验依据: 'YJ-Q-30' })
})

test('抬头带入:要求表两列全空 ⇒ 不返回任何键(报告保留默认 YJ-QR-96 / YJ-Q-30)', () => {
  const rows = [{ id: 1, 物料类别: '折叠棉', 物料编号: 'M-3', 折叠棉: '47*34*154-1' }]
  const plan = carryPlan(rows, 'M-3', [])
  assert.deepEqual(plan.head, {})
  assert.equal(plan.entries.length, 1, '检验项照常带')
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

/* ── 「自定义检验要求」页签(2026-10-04):列由动态字段(备用列池)定义 ──
   后端 QueryService.rowToLabels 按 label 下发 ⇒ 行键就是列名(动态字段=备用列上绑的中文名),
   故带入口径与固定 7 张表**完全一致**;该页签 cols 为空,列序取行自身键序(=yj_field 的 seq 序)。 */
test('自定义页签:列名就是检验项(行键=label),顺序=字段登记顺序', () => {
  const rows = [{
    id: 12,
    物料类别: '自定义检验要求',
    物料编号: 'YJ-YCYX-006',
    平整度: '无毛刺',
    盐雾时长: '48h',
  }]
  const entries = carryEntriesOf(lookupReqGroups(rows, 'YJ-YCYX-006'))
  assert.deepEqual(entries, [
    { 检验项: '平整度', 检测标准: '无毛刺' },
    { 检验项: '盐雾时长', 检测标准: '48h' },
  ])
  // 标识列照旧不成项
  assert.ok(!entries.some((e) => e.检验项 === '物料编号' || e.检验项 === '物料类别'))
})

test('自定义页签 + 固定页签同时命中:按页签配置序(固定 7 张在前,自定义殿后)', () => {
  const rows = [
    { id: 12, 物料类别: '自定义检验要求', 物料编号: 'YJ-YCYX-006', 平整度: '无毛刺' },
    { id: 1, 物料类别: '折叠棉', 物料编号: 'YJ-YCYX-006', 折叠棉: '47*34*154-1' },
  ]
  const plan = carryPlan(rows, 'YJ-YCYX-006', [])
  assert.deepEqual(plan.entries.map((e) => e.检验项), ['折叠棉', '平整度'], '折叠棉页签在前、自定义页签在最后')
})

/* ── 每张表各自的自定义列(2026-10-04 用户口径:「自定义字段单独针对每个表」)──
   列 = 该表的固定列(Excel 原列序) + 属于该表的动态字段(追加在后);别的表的自定义列不串入。 */
test('固定表也带自定义列:固定列在前、该表自定义列追加在后', () => {
  const rows = [{
    id: 1, 物料类别: '折叠棉', 物料编号: 'YJ-YCYX-006',
    折叠棉: '47*34*154-1', 炭棒: '34*12*154', 折数: '75±5', 折高: '6--7',
    炭棒直径: '34.2',            // 折叠棉表的自定义列
    外观: '无脏污',              // 垫片表的自定义列(串进来就是 bug)
  }]
  const ext = [
    { label: '炭棒直径', col: '备用1', tab: '折叠棉' },
    { label: '外观', col: '备用2', tab: '垫片' },
  ]
  const entries = carryEntriesOf(lookupReqGroups(rows, 'YJ-YCYX-006'), ext)
  assert.deepEqual(entries.map((e) => e.检验项), ['折叠棉', '炭棒', '折数', '折高', '炭棒直径'], '自定义列追加在固定列之后')
  assert.ok(!entries.some((e) => e.检验项 === '外观'), '别的表的自定义列不带进来')
})

test('同一列名可以在不同表各有一列(同名互不影响)', () => {
  const rows = [
    { id: 1, 物料类别: '折叠棉', 物料编号: 'M-C', 外观: '无毛刺' },
    { id: 2, 物料类别: '垫片', 物料编号: 'M-C', 外观: '无划痕' },
  ]
  const ext = [
    { label: '外观', col: '备用1', tab: '折叠棉' },
    { label: '外观', col: '备用2', tab: '垫片' },
  ]
  const entries = carryEntriesOf(lookupReqGroups(rows, 'M-C'), ext)
  assert.deepEqual(entries, [{ 检验项: '外观', 检测标准: '无毛刺' }],
    '同名项去重:取首个非空数据(两表同名同物料时只带一条,不重复)')
})

/** 源码级回归:检验报告必须挂带入入口,且带入算法只此一份(不各写一遍合并逻辑) */
test('页面接线:检验报告有「带入检验要求」入口,且走 qcInspReqCarry', () => {
  const src = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(src, /@core\/qc\/qcInspReqCarry/, '必须引用带入纯逻辑模块')
  assert.match(src, /carryPlan\(/, '必须用 carryPlan 算该补的行')
  assert.match(src, /tt\('带入检验要求'\)/, '要有「带入检验要求」入口')
})
