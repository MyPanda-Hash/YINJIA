import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normCode,
  matchReqRowsByMaterial,
  reqGroupsOf,
  reqTabKeysOf,
  lookupReqGroups,
  orphanRowsOf,
  orphanGroupsOf,
  orphanColsOf,
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

/* ── 未归类行(2026-11-06):物料类别已下线/脏值 ⇒ 归不进任何现役页签,但不能静默丢掉 ──
 * 实测现场:YJ-XH-001 在 qc_insp_req 里有一行 物料类别='自定义检验要求'(2026-10-04 已下线),
 * 弹窗只显示「另有 1 行…」却不给内容,而「带入检验要求」会把 外径/内径=按图纸 带进报告。 */
const ORPHAN_ROWS = [
  { id: 3, 物料类别: '自定义检验要求', 物料编号: 'YJ-XH-001', 文件编码: 'QR-QC-001', 外径: '按图纸', 检验方法1: '称样' },
  { id: 1, 物料类别: '自定义检验要求', 物料编号: 'YJ-XH-001', 内径: '按图纸' },
  { id: 2, 物料类别: '', 物料编号: 'YJ-XH-001', 厚度: '按图纸' },
  { id: 9, 物料类别: '炭粉', 物料编号: 'YJ-XH-001', 检验标准1: '碘值<900 拒收' },
]

test('未归类行:按本面板页签判,tab=null 的组展平', () => {
  const groups = reqGroupsOf(matchReqRowsByMaterial(ORPHAN_ROWS, 'YJ-XH-001'), qcInspReqTabs)
  assert.equal(groups.filter((g) => g.tab).length, 0, '固定 7 页签一个都不认这些类别')
  assert.deepEqual(orphanRowsOf(groups).map((r) => r.id), [1, 2, 3, 9], '按 id 升序')
})

test('未归类行:挂别的面板页签(炭粉)也算未归类 —— 只按**本面板**页签判', () => {
  // 弹窗里固定表那一段只认 7 张固定页签:行上写着 炭粉 却存在 qc_insp_req 里,
  // 旧算法按两面板页签并集判会当"已知"⇒ 两个面板都不渲染,静默消失;本口径把它算未归类、显示出来。
  const groups = reqGroupsOf(matchReqRowsByMaterial(ORPHAN_ROWS, 'YJ-XH-001'), qcInspReqTabs)
  assert.ok(orphanRowsOf(groups).some((r) => r.id === 9 && r['物料类别'] === '炭粉'))
})

test('未归类分组:一个物料类别一个组(空类别自成一组,key="")', () => {
  const groups = reqGroupsOf(matchReqRowsByMaterial(ORPHAN_ROWS, 'YJ-XH-001'), qcInspReqTabs)
  const out = orphanGroupsOf(groups)
  assert.deepEqual(out.map((g) => g.key), ['自定义检验要求', '', '炭粉'], '组序 = 各组最小 id 序')
  assert.deepEqual(out.find((g) => g.key === '自定义检验要求').rows.map((r) => r.id), [1, 3])
  assert.deepEqual(out.find((g) => g.key === '').rows.map((r) => r.id), [2])
})

test('未归类列:标识列在前、剔除物料类别/主键/审计列,长文本列给宽', () => {
  const cols = orphanColsOf(ORPHAN_ROWS)
  const keys = cols.map((c) => c.key)
  assert.deepEqual(keys.slice(0, 2), ['物料编号', '文件编码'], '标识列在最前(本样例无 检验依据)')
  assert.ok(!keys.includes('物料类别'), '分流键不是内容列')
  assert.ok(!keys.includes('id') && !keys.some((k) => k.startsWith('asp_')))
  assert.ok(!keys.includes('__panel'), '前端内部标记(__panel)不是业务列')
  assert.equal(new Set(keys).size, keys.length, '跨行同名列只出一列')
  assert.ok(cols.find((c) => c.key === '检验方法1').w > cols.find((c) => c.key === '外径').w, '方法/标准类长文本列更宽')
  assert.deepEqual(orphanColsOf([]), [], '无行给空列')
  // 检验依据 存在时必须紧随 物料编号/文件编码
  const withBasis = orphanColsOf([{ id: 1, 物料类别: 'X', 检验依据: 'YJ-Q-03', 外径: '按图纸' }])
  assert.deepEqual(withBasis.map((c) => c.key), ['检验依据', '外径'])
})

test('页面接线:弹窗必须把未归类行渲染成页签(不能只计数)', () => {
  const dlg = readFileSync(new URL('../views/QcInspReqViewDialog.vue', import.meta.url), 'utf8')
  assert.match(dlg, /:extra-tabs="sec\.extras"/, '未归类页签要传给只读嵌入的表格')
  assert.match(dlg, /orphanColsOf/, '未归类行的列按行自身字段名取')
  assert.match(dlg, /未归类/, '页签标题要标明未归类')
  const sheet = readFileSync(new URL('../views/QcInspReqSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /extraTabs: \{ type: Array/, '表格组件要接受额外页签')
})

test('页面接线:检验数据记录组件必须有入口,且弹窗只读嵌入检验要求表', () => {
  const rec = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(rec, /QcInspReqViewDialog/, '检验数据记录必须挂「检验要求」查看弹窗')
  assert.match(rec, /物料编码/, '入口按物料编码取键')
  const dlg = readFileSync(new URL('../views/QcInspReqViewDialog.vue', import.meta.url), 'utf8')
  assert.match(dlg, /show-toolbar="false"|:show-toolbar="false"/, '弹窗里嵌入的检验要求表必须隐藏维护工具栏')
  assert.match(dlg, /:editable="false"/, '弹窗里必须是只读')
})

/* 2026-11-06 用户口径:弹窗里也要能「带入检验要求」—— 草稿(含保存后)可带入;
 * 提交审批/审核后不可;弃审退回草稿后恢复。判定 = 本单可编辑(editable),不另立一套状态表。 */
test('页面接线:检验要求弹窗自带「带入」按钮,并按单据状态置灰', () => {
  const dlg = readFileSync(new URL('../views/QcInspReqViewDialog.vue', import.meta.url), 'utf8')
  assert.match(dlg, /emit\('carry'\)/, '弹窗只发事件,真正带入由父级(报告表)执行')
  assert.match(dlg, /:disabled="!canCarry"/, '不可编辑时必须置灰')
  assert.match(dlg, /blockedHint/, '置灰要说明原因')
  const rec = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')
  assert.match(rec, /:can-carry="editable"/, '可带入 = 本单可编辑(草稿/修改中)')
  assert.match(rec, /@carry="onDialogCarry"/, '弹窗的带入要接到同一个 carryFromReq')
  assert.match(rec, /单据状态/, '不可带入的原因按单据状态给出')
  assert.match(rec, /已审核/, '审核后不可带入要说出来')
})
