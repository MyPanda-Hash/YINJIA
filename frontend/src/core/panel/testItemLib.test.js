import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toCanonical,
  emptyEntry,
  toSpecSub,
  toInspRow,
  isCanonical,
  CANONICAL_KEYS,
} from './testItemLib.js'

/**
 * 这组断言守的是 2026-09-11 的口径:**检验项目标准库在规格书(RD_SPEC_DOC)与
 * 出货检验计划表(RD_INSP_PLAN)之间互通**——两个面板共用同一批条目,一边新增/编辑,
 * 另一边立刻可选。难点是两边的 JSON 形状完全不同:
 *   · 规格书(旧 spec.test): item_code=组名, content={sub,req,method,basis}
 *   · 出货计划(旧 insp.plan): item_code=表区名, content=10 个中文键
 * 所以统一到一份规范结构(canonical),再各自投影回自己的形态;**空字段一律留空,不丢数据**。
 */

test('旧规格书条目 → 规范结构:item 当组名,sub 当 name', () => {
  const e = toCanonical({ sub: '产品尺寸', req: '外径28±0.5', method: '游标卡尺', basis: '银嘉标准' }, '尺寸')
  assert.equal(e.group, '尺寸')
  assert.equal(e.name, '产品尺寸')
  assert.equal(e.req, '外径28±0.5')
  assert.equal(e.method, '游标卡尺')
  assert.equal(e.basis, '银嘉标准')
  assert.equal(e.quality, '')
})

test('旧出货计划条目 → 规范结构:10 个中文键逐一映射,不丢一个', () => {
  const legacy = {
    控制项目: '外观', 质量控制内容: '无破损', 检测仪器: '目视', 控制标准及要求: '银嘉标准',
    检验: 'IQC', 不合格应对措施: '退货', 检测频率: '每批', 取样方式: '随机', 检验内容: '外观检查', 控制方法: '目测',
  }
  const e = toCanonical(legacy, '必测项')
  assert.equal(e.group, '必测项')
  assert.equal(e.name, '外观')
  assert.equal(e.quality, '无破损')
  assert.equal(e.instrument, '目视')
  assert.equal(e.req, '银嘉标准')
  assert.equal(e.inspect, 'IQC')
  assert.equal(e.measure, '退货')
  assert.equal(e.freq, '每批')
  assert.equal(e.sampling, '随机')
  assert.equal(e.content, '外观检查')
  assert.equal(e.method, '目测')
})

test('规范结构 → 规格书子项:只带 name/req/method/basis,出货计划专有字段不带过去', () => {
  const e = { ...emptyEntry(), group: '必测项', name: '外观', req: '银嘉标准', method: '目测', freq: '每批', content: '外观检查' }
  const sub = toSpecSub(e)
  assert.deepEqual(sub, { name: '外观', req: '银嘉标准', method: '目测', basis: '' })
})

test('规范结构 → 出货计划行:10 个中文键齐全,规格书没有的字段留空不丢结构', () => {
  const e = { ...emptyEntry(), group: '尺寸', name: '产品尺寸', req: '外径28±0.5', method: '游标卡尺', basis: '银嘉标准' }
  const row = toInspRow(e)
  assert.equal(row['控制项目'], '产品尺寸')
  assert.equal(row['控制标准及要求'], '外径28±0.5')
  assert.equal(row['控制方法'], '游标卡尺')
  assert.equal(row['质量控制内容'], '')
  assert.equal(row['检测仪器'], '')
  assert.equal(row['检测频率'], '')
  assert.equal(row['检验内容'], '')
  for (const k of ['控制项目', '质量控制内容', '检测仪器', '控制标准及要求', '检验', '不合格应对措施', '检测频率', '取样方式', '检验内容', '控制方法']) {
    assert.ok(k in row, `出货计划行缺列 ${k}`)
  }
})

test('互通本意:一边存的条目落到另一边仍然成立(规格书↔出货计划双向)', () => {
  // 规格书里录的,出货计划表里要能选中并显示在对应列
  const fromSpec = toCanonical({ sub: '整体尺寸', req: '长210±1', method: '卡尺', basis: '银嘉标准' }, '尺寸')
  const inspRow = toInspRow(fromSpec)
  assert.equal(inspRow['控制项目'], '整体尺寸')
  assert.equal(inspRow['控制标准及要求'], '长210±1')
  // 出货计划里录的,规格书里要能作为子项勾选
  const fromInsp = toCanonical({ 控制项目: '外观', 控制标准及要求: '无破损', 控制方法: '目视' }, '必测项')
  const specSub = toSpecSub(fromInsp)
  assert.equal(specSub.name, '外观')
  assert.equal(specSub.req, '无破损')
  assert.equal(specSub.method, '目视')
})

test('规范结构可原样往返(幂等):已是 v2 的内容再解析不变', () => {
  const e = { ...emptyEntry(), group: '必测项', name: '外观', req: 'R', freq: 'F' }
  assert.equal(isCanonical(e), true)
  assert.deepEqual(toCanonical(e, '别的组'), e) // 已规范化时不再用 item 覆盖 group
})

test('坏内容/空内容不抛异常,退化为空条目(不能把界面打挂)', () => {
  for (const bad of [null, undefined, '', 'not-json', 123, []]) {
    const e = toCanonical(bad, '组')
    assert.equal(e.name, '')
    assert.equal(e.group, '组')
  }
})

test('规范结构的键集合稳定(CANONICAL_KEYS 是唯一真源,新增字段要同步改这里)', () => {
  const e = emptyEntry()
  assert.deepEqual(Object.keys(e).sort(), [...CANONICAL_KEYS].sort())
  assert.equal(e.v, 2)
})
