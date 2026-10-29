/**
 * recordGroup.test.js —— 「一张单据按下拉分组填多组数据」的行分组规则
 *
 * 【需求来源】用户 2026-10-28 口径:
 *   「把这三张表按测试项目、设备名称、仪器名称这些下拉来切数据表填写,就是改为一张单据,
 *    可以通过切换这些内容来给对应的项目、设备、仪器,分别填写数据,一张单据可填写的内容就多一些,
 *    而不是不同项目、仪器、设备都要新建一张单」
 *
 * 现状:三张表(设备使用登记表 RD_EQUIP_USE / 仪器使用记录表 RD_INSTR_USE /
 *   加标水配置记录表 RD_SPIKE_WATER)的下拉只是「标题/列集」开关,明细是**同一批行** ——
 *   切到另一台设备,原设备的行还在表里 ⇒ 只能一台设备建一张单。
 *
 * 口径:
 *   · 明细行带「分组值」(=该行的设备名称/仪器名称/测试项目),它决定这行属于哪一组;
 *   · 当前下拉值 = 正在编辑哪一组;切换下拉 = 换显示的行,其它组行**留在单据里不丢**;
 *   · 保存时整份明细一起提交(不按组裁剪),重开单据按组切换仍能看到各自的数据;
 *   · 旧数据兼容:分组列为空的行(改造前录的)视为「当前下拉那一组」,不能因为改造而看不见。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { inGroup, groupRows, stampGroup, groupOf } from './recordGroup.js'

const KEY = '设备名称'

test('空分组值的旧行归到当前组（改造前的数据不能丢）', () => {
  assert.equal(inGroup({ 使用日期: '2026-10-01' }, KEY, '加标系统1'), true)
  assert.equal(inGroup({ 设备名称: '', 使用日期: '2026-10-01' }, KEY, '加标系统1'), true)
  assert.equal(inGroup({ 设备名称: null }, KEY, '加标系统1'), true)
})

test('有分组值的行只在对应组里出现', () => {
  const rows = [
    { 设备名称: '加标系统1', 使用日期: '10-01' },
    { 设备名称: '加标系统2', 使用日期: '10-02' },
    {},
  ]
  assert.deepEqual(groupRows(rows, KEY, '加标系统1').map((r) => r.使用日期), ['10-01', undefined])
  assert.deepEqual(groupRows(rows, KEY, '加标系统2').map((r) => r.使用日期), ['10-02', undefined])
})

test('当前下拉为空时不过滤（历史单/未选设备时保持原样，不能把行藏掉）', () => {
  const rows = [{ 设备名称: 'A' }, { 设备名称: 'B' }]
  assert.equal(groupRows(rows, KEY, '').length, 2)
  assert.equal(groupRows(rows, KEY, null).length, 2)
  assert.equal(inGroup({ 设备名称: 'A' }, KEY, ''), true)
})

test('新增行写入当前下拉值（否则该行会飘在"空组"里）', () => {
  const row = {}
  assert.equal(stampGroup(row, KEY, '加标系统3'), true)
  assert.equal(row[KEY], '加标系统3')
  // 已有值的行不被覆盖（切组时不能把别的设备行改成本设备）
  const keep = { 设备名称: '加标系统1' }
  assert.equal(stampGroup(keep, KEY, '加标系统2'), false)
  assert.equal(keep[KEY], '加标系统1')
})

test('groupOf:读行上的分组值并按字段口径归一（数字/空格/缺省）', () => {
  assert.equal(groupOf({ [KEY]: ' 加标系统1 ' }, KEY), '加标系统1')
  assert.equal(groupOf({ [KEY]: 7 }, KEY), '7')
  assert.equal(groupOf({}, KEY), '')
  assert.equal(groupOf({ [KEY]: 'x' }, ''), '')
})
