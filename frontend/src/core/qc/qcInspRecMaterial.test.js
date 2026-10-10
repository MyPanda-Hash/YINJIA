/**
 * 检验数据记录的「物料名称 / 物料编码 关联商品」——带回语义与页面接线的回归闸。
 *
 * 用户口径(2026-10-09):「检验数据记录的物料名称和物料编码要关联商品,并且要两个一并填入。」
 * 落点:① 数据库 yj_field 四行 data_type 文本→参照/INV(tools/migrate-qc-insp-rec-material-ref-20261009.sql);
 *       ② 后端 buildRefMap 现算出 refMap(见下方 MAPPING — 实测取自 getPanelConfig 下发内容);
 *       ③ 页面 QcInspRecSheet.vue 按配置开参照弹窗、写主字段、按 refMap 整串带回。
 * 本测试盯住「一并填入」这条语义:**选任一侧的商品,另一侧同时有值** ——
 * refMap 是后端算的,这里把实测下发的映射固化下来,防止将来同义词表/字段登记被改动后悄悄退化。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyRefCarry, refConfigOf } from '../ref/refCarry.js'

/** 实测下发的两条字段配置(2026-10-09,GET /api/px/getPanelConfig?panelCode=QC_INSP_REC) */
const REF_MATERIAL_NAME = {
  dataName: '物料名称', dataType: '参照', refPanel: 'INV', refField: '存货名称', displayField: '存货名称',
  refMap: [
    { to: '计量单位', from: '计量单位' },
    { to: '备注', from: '备注' },
    { to: '物料编码', from: '存货编码' },   // ← 配对的那一列
  ],
}
const REF_MATERIAL_CODE = {
  dataName: '物料编码', dataType: '参照', refPanel: 'INV', refField: '存货编码', displayField: '存货名称',
  refMap: [
    { to: '计量单位', from: '计量单位' },
    { to: '备注', from: '备注' },
    { to: '物料名称', from: '存货名称' },   // ← 配对的那一列
  ],
}

/** 商品档案(INV)一条真实行:键 = 字段标签;备注列不在 INV 列表返回里(实测 75 键无备注) */
const INV_ROW = { 存货编码: 'YJ-YCYX-006', 存货名称: '折叠棉', 计量单位: '张', 规格型号: '47*34*154-1' }

/** 页面确认逻辑的最小复刻(与 QcInspRecSheet.onRefConfirm 同序:先写主字段,再按 refMap 带回) */
function pick(head, field, src) {
  const key = field.dataName
  head[key] = src[field.refField || key] ?? ''
  applyRefCarry(head, src, refConfigOf(field), key)
  return head
}

test('选物料编码 → 物料名称一并填入(两侧都有值)', () => {
  const head = {}
  pick(head, REF_MATERIAL_CODE, INV_ROW)
  assert.equal(head['物料编码'], 'YJ-YCYX-006')
  assert.equal(head['物料名称'], '折叠棉', '配对字段必须同时填上')
})

test('选物料名称 → 物料编码一并填入(反向同样成立)', () => {
  const head = {}
  pick(head, REF_MATERIAL_NAME, INV_ROW)
  assert.equal(head['物料名称'], '折叠棉')
  assert.equal(head['物料编码'], 'YJ-YCYX-006', '配对字段必须同时填上')
})

test('主字段取 refField 的原始值(编码列存编码,不是显示名)', () => {
  const head = {}
  pick(head, REF_MATERIAL_CODE, INV_ROW)
  assert.equal(head['物料编码'], INV_ROW['存货编码'], '物料编码格存的必须是存货编码')
  assert.notEqual(head['物料编码'], INV_ROW['存货名称'])
})

test('源行缺 from 值的映射不覆盖(INV 行不含备注 ⇒ 报告备注不被清掉)', () => {
  const head = { 备注: '手填的处理说明' }
  pick(head, REF_MATERIAL_CODE, INV_ROW)
  assert.equal(head['备注'], '手填的处理说明')
  assert.equal(head['计量单位'], '张', '源行有值的同名字段照带(与四单同口径)')
})

test('换选另一个商品:两列一起被换成新商品的值(不会只换一半)', () => {
  const head = { 物料名称: '折叠棉', 物料编码: 'YJ-YCYX-006' }
  pick(head, REF_MATERIAL_CODE, { 存货编码: 'YJ-KBL-021', 存货名称: '气泡袋' })
  assert.deepEqual([head['物料编码'], head['物料名称']], ['YJ-KBL-021', '气泡袋'])
})

/* ── 页面接线:配置驱动的参照单元格(不硬编码面板名/列名) ── */
const sheet = readFileSync(new URL('../views/QcInspRecSheet.vue', import.meta.url), 'utf8')

test('页面接线:抬头两格按 refPanel 开商品参照,确认后按 refMap 带回', () => {
  assert.match(sheet, /import RefPickDialog from '\.\/RefPickDialog\.vue'/, '必须挂参照弹窗组件')
  assert.match(sheet, /from '@core\/ref\/refCarry'/, '必须复用共用带回函数,不自己抄一遍')
  assert.match(sheet, /isRefKey\(cell\.key\)/, '参照格必须按字段配置判定(refPanel),不硬编码列名')
  assert.match(sheet, /applyRefCarry\(props\.head, src, refConfigOf\(f\), key\)/, '确认后按 refMap 整串带回')
  assert.match(sheet, /<RefPickDialog v-model="refPickVisible" :field="refPickField"/, '弹窗要绑当前字段')
})

test('页面接线:参照格在前、纯输入框只作兜底(未配参照的字段才手填)', () => {
  assert.match(sheet, /v-if="editable && !cell\.locked && isRefKey\(cell\.key\)"/)
  assert.match(sheet, /<el-input\s+v-else-if="editable && !cell\.locked"/, '输入框必须退化为 else-if 兜底')
  assert.doesNotMatch(sheet, /cell\.key === '物料编码' && !isRefKey/, '不得按列名特判绕开参照')
})
