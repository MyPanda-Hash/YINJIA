import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normCode,
  matchReqRowsByMaterial,
  reqGroupsOf,
  reqTabKeysOf,
  lookupReqGroups,
} from './qcInspReqLookup.js'
import { qcInspReqTabs } from '../views/qcInspReqConfig.js'

const ROWS = [
  { id: 5, 物料类别: 'PP棉', 物料编号: 'YJ-TS-002', 尺寸: 'φ30' },
  { id: 2, 物料类别: '折叠棉', 物料编号: 'YJ-YCYX-008', 折叠棉: '60g' },
  { id: 9, 物料类别: '折叠棉', 物料编号: 'YJ-YCYX-008', 折叠棉: '70g' },
  { id: 3, 物料类别: 'PP管', 物料编号: 'YJ-JB-001' },
  { id: 4, 物料类别: '折叠棉', 物料编号: 'YJ-YCYX-0081', 折叠棉: '误命中样例' },
]

test('normCode:去首尾空白;null/undefined → 空串', () => {
  assert.equal(normCode('  YJ-YCYX-008 '), 'YJ-YCYX-008')
  assert.equal(normCode(null), '')
  assert.equal(normCode(undefined), '')
})

test('精确匹配:两侧都 trim 后相等才算命中', () => {
  const hit = matchReqRowsByMaterial(ROWS, ' YJ-YCYX-008 ')
  assert.deepEqual(hit.map((r) => r.id), [2, 9])
})

test('不做模糊匹配:YJ-YCYX-008 不得命中 YJ-YCYX-0081', () => {
  const hit = matchReqRowsByMaterial(ROWS, 'YJ-YCYX-008')
  assert.ok(!hit.some((r) => r['物料编号'] === 'YJ-YCYX-0081'), '前缀相同的编号不能被带出来')
  assert.equal(hit.length, 2)
})

test('物料编码为空/行集缺失 → 空结果(不报错)', () => {
  assert.deepEqual(matchReqRowsByMaterial(ROWS, ''), [])
  assert.deepEqual(matchReqRowsByMaterial(ROWS, '   '), [])
  assert.deepEqual(matchReqRowsByMaterial(ROWS, null), [])
  assert.deepEqual(matchReqRowsByMaterial(null, 'YJ-YCYX-008'), [])
})

test('分组:按页签配置序(不是数据出现顺序),组内 id 升序', () => {
  const groups = reqGroupsOf(matchReqRowsByMaterial(ROWS, 'YJ-YCYX-008'))
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, '折叠棉')
  assert.equal(groups[0].tab, qcInspReqTabs.find((t) => t.key === '折叠棉'), '带上配置(列定义取自此)')
  assert.deepEqual(groups[0].rows.map((r) => r.id), [2, 9], 'id 升序 = Excel 原序')
})

test('多类别命中:顺序循页签配置序,与数据出现顺序无关', () => {
  const cfgOrder = qcInspReqTabs.map((t) => t.key)
  const first = cfgOrder[0]
  const last = cfgOrder[cfgOrder.length - 1]
  // 故意倒着喂:数据里 last 在前,输出必须回到配置序(first 在前)
  const rows = [
    { id: 1, 物料类别: last, 物料编号: 'M1' },
    { id: 2, 物料类别: first, 物料编号: 'M1' },
  ]
  const got = reqGroupsOf(matchReqRowsByMaterial(rows, 'M1')).map((g) => g.key)
  assert.deepEqual(got, [first, last], `应按配置序输出(配置序首=${first}、末=${last})`)
})

test('配置外的物料类别不静默丢弃:作为 tab=null 的组殿后,且不进 tabKeys', () => {
  const rows = [
    { id: 1, 物料类别: '折叠棉', 物料编号: 'M2' },
    { id: 2, 物料类别: '外星料', 物料编号: 'M2' },
  ]
  const groups = reqGroupsOf(matchReqRowsByMaterial(rows, 'M2'))
  assert.equal(groups.length, 2)
  assert.equal(groups[1].tab, null)
  assert.deepEqual(groups[1].rows.map((r) => r.id), [2])
  assert.deepEqual(reqTabKeysOf(groups), ['折叠棉'])
})

test('一行到位:lookupReqGroups = 匹配 + 分组;无命中给空数组', () => {
  assert.deepEqual(lookupReqGroups(ROWS, 'YJ-TS-002').map((g) => g.key), ['PP棉'])
  assert.deepEqual(lookupReqGroups(ROWS, '不存在的编号'), [])
})

test('页面接线:检验数据记录组件必须有入口,且弹窗只读嵌入检验要求表', () => {
  const rec = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(rec, /QcInspReqViewDialog/, '检验数据记录必须挂「检验要求」查看弹窗')
  assert.match(rec, /物料编码/, '入口按物料编码取键')
  const dlg = readFileSync(new URL('../views/QcInspReqViewDialog.vue', import.meta.url), 'utf8')
  assert.match(dlg, /show-toolbar="false"|:show-toolbar="false"/, '弹窗里嵌入的检验要求表必须隐藏维护工具栏')
  assert.match(dlg, /:editable="false"/, '弹窗里必须是只读')
})
