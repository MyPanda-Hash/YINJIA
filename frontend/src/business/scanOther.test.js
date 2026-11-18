/**
 * scanOther.test.js — 手机扫码 · 其他领料/其他退料 纯逻辑单测(2026-11-16)
 *
 * 钉住三件容易改坏的事:
 *  ① 单据方向:其他领料 → 其他出库单(OTHER_OUT)、其他退料 → 生产退料单(MATERIAL_RET);
 *  ② 表单键名必须用**面板标签**(OTHER_OUT 明细叫「批次号」不叫「批号」,
 *     MATERIAL_RET 明细叫「材料编码」不叫「存货编码」)—— 写错键 = 该列静默丢值;
 *  ③ 同(物料,批号,仓库)重复扫码要累加,且领料累加后仍不得超现存量。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SIDE_PICK, SIDE_RET, panelOfSide, bizOfSide, titleOfSide, isRet, normalizeSide,
  lineKey, checkQty, mergeLine, buildForm, buildOtherOutForm, buildMaterialRetForm, doneMessage,
  toWarehouseOptions, defaultWarehouseCode, withWarehouse,
} from './scanOther.js'

const cand = (over = {}) => ({
  存货编码: 'YJ-KBL-012',
  存货名称: 'PP棉',
  规格型号: '45*16*109',
  计量单位: '支',
  仓库编码: 'CK00006',
  仓库: '华北工控仓',
  批号: 'PC0000',
  现存量: 10,
  结存单价: 5,
  ...over,
})

test('side → 单据面板 / 业务类型 / 标题', () => {
  assert.equal(panelOfSide(SIDE_PICK), 'OTHER_OUT', '其他领料落其他出库单(扣库存)')
  assert.equal(panelOfSide(SIDE_RET), 'MATERIAL_RET', '其他退料落生产退料单')
  // 业务类型是数据键,永不翻译;OTHER_OUT 的字典只有「其他出库」一个值
  assert.equal(bizOfSide(SIDE_PICK), '其他出库')
  assert.equal(bizOfSide(SIDE_RET), '生产退料', '用户口径:其他退料就还是按生产退料来')
  assert.equal(titleOfSide(SIDE_PICK), '其他领料')
  assert.equal(titleOfSide(SIDE_RET), '其他退料')
  // 未知 side 一律按领料(与后端 scanMaterial 的归一化一致),不能默默退化成退料
  assert.equal(normalizeSide('xxx'), SIDE_PICK)
  assert.equal(isRet('xxx'), false)
})

test('清单合并键 = 物料|批号|仓库(三者任一不同就是另一行)', () => {
  assert.equal(lineKey({ code: 'A', batch: 'B1', warehouseCode: 'CK1' }), 'A|B1|CK1')
  assert.equal(lineKey({ code: 'A', batch: 'B1', warehouse: '华北仓' }), 'A|B1|华北仓')
  assert.equal(lineKey(null), '||')
  // 同物料不同仓不得合并(否则账记在 A 仓、货在 B 仓)
  assert.notEqual(
    lineKey({ code: 'A', batch: 'B1', warehouseCode: 'CK1' }),
    lineKey({ code: 'A', batch: 'B1', warehouseCode: 'CK2' }),
  )
})

test('数量校验:领料受库存约束,退料只要 > 0', () => {
  assert.deepEqual(checkQty(SIDE_PICK, 0, 10), { ok: false, reason: 'no-qty' })
  assert.deepEqual(checkQty(SIDE_PICK, 11, 10), { ok: false, reason: 'exceed' })
  assert.deepEqual(checkQty(SIDE_PICK, 10, 10), { ok: true })
  assert.deepEqual(checkQty(SIDE_PICK, 1, 0), { ok: false, reason: 'no-stock' })
  // 退料:手上这批货,没有"已领多少"可比 ⇒ 不看现存量
  assert.deepEqual(checkQty(SIDE_RET, 999, 0), { ok: true })
  assert.deepEqual(checkQty(SIDE_RET, 0, 0), { ok: false, reason: 'no-qty' })
  // 小数(kg/米)按 4 位比较,不能因浮点尾差误判超量
  assert.deepEqual(checkQty(SIDE_PICK, 0.1 + 0.2, 0.3), { ok: true })
})

test('mergeLine:新行/同键累加/领料累加超量被拦/退料无上限/不改入参', () => {
  const first = mergeLine([], cand(), 3, SIDE_PICK)
  assert.equal(first.ok, true)
  assert.equal(first.lines.length, 1)
  assert.equal(first.lines[0].qty, 3)
  assert.equal(first.lines[0].name, 'PP棉')
  assert.equal(first.lines[0].price, 5)

  const base = first.lines
  const second = mergeLine(base, cand(), 4, SIDE_PICK)
  assert.equal(second.lines.length, 1, '同(物料,批号,仓库)应累加,不新增行')
  assert.equal(second.lines[0].qty, 7)
  assert.equal(base[0].qty, 3, '入参不能被就地改坏')

  const over = mergeLine(base, cand(), 8, SIDE_PICK)   // 3+8=11 > 存量 10
  assert.equal(over.ok, false)
  assert.equal(over.reason, 'exceed')

  const ret = mergeLine(base, cand({ 现存量: 0 }), 100, SIDE_RET)
  assert.equal(ret.ok, true, '退料不看现存量')

  // 不同仓库 ⇒ 另起一行
  const other = mergeLine(base, cand({ 仓库编码: 'CK00007', 仓库: '半成品仓' }), 1, SIDE_PICK)
  assert.equal(other.lines.length, 2)
})

test('其他领料表单:OTHER_OUT + 明细用面板标签(批次号/存货编码)', () => {
  const lines = mergeLine([], cand(), 3, SIDE_PICK).lines
  const form = buildOtherOutForm(lines, { date: '2026-11-16', operator: '张三' })
  assert.equal(form.业务类型, '其他出库')
  assert.equal(form.单据日期, '2026-11-16')
  assert.equal(form.单据编号, '', '单号必须留空交给后端 FormNoService')
  assert.equal(form.经手人, '张三')
  const it = form.detail.items[0]
  assert.equal(it.存货编码, 'YJ-KBL-012')
  assert.equal(it.存货名称, 'PP棉')
  assert.equal(it.计量单位, '支')
  assert.equal(it.仓库, '华北工控仓')
  assert.equal(it.仓库编码, 'CK00006')
  assert.equal(it.批次号, 'PC0000', 'OTHER_OUT 明细标签是「批次号」(物理列才叫 批号)')
  assert.equal(it.数量, 3)
  assert.equal(it.单价, 5)
  assert.equal(it.金额, 15)
  assert.equal(it.行号, '1')
  assert.ok(it.明细备注.includes('其他领料'))
})

test('其他退料表单:MATERIAL_RET + 业务类型生产退料 + 不写工单号', () => {
  const lines = mergeLine([], cand(), 2, SIDE_RET).lines
  const form = buildMaterialRetForm(lines, { date: '2026-11-16', operator: '李四' })
  assert.equal(form.业务类型, '生产退料', '用户口径:其他退料仍按生产退料')
  assert.equal(form.领用人, '李四')
  // 这两页不绑工单 ⇒ 写空比写假单号好(生产退料明细表按工单号一筛就是脏数据)
  assert.equal(form.工单号, undefined)
  assert.equal(form.工单行号, undefined)
  const it = form.detail.items[0]
  assert.equal(it.材料编码, 'YJ-KBL-012', 'MATERIAL_RET 明细标签是「材料编码」')
  assert.equal(it.材料名称, 'PP棉')
  assert.equal(it.计量单位, '支')
  assert.equal(it.批次号, 'PC0000')
  assert.equal(it.数量, 2)
  assert.equal(it.金额, 10)
  assert.ok(it.明细备注.includes('其他退料'))
})

test('buildForm 按 side 分派,不会串单', () => {
  const lines = mergeLine([], cand(), 1, SIDE_PICK).lines
  assert.equal(buildForm(SIDE_PICK, lines).业务类型, '其他出库')
  assert.equal(buildForm(SIDE_RET, lines).业务类型, '生产退料')
  // 明细键也必须跟着换(领料存货 / 退料材料)
  assert.ok(buildForm(SIDE_PICK, lines).detail.items[0].存货编码)
  assert.ok(buildForm(SIDE_RET, lines).detail.items[0].材料编码)
})

test('提交成功提示带单号,空单号也不出现 "null"', () => {
  assert.ok(doneMessage(SIDE_PICK, 'OO-20261116-0001').includes('OO-20261116-0001'))
  assert.ok(doneMessage(SIDE_PICK, 'OO-20261116-0001').includes('其他出库单'))
  assert.ok(doneMessage(SIDE_RET, 'TL-20261116-0001').includes('生产退料单'))
  assert.ok(!doneMessage(SIDE_PICK, '').includes('null'))
  assert.ok(!doneMessage(SIDE_RET, null).includes('undefined'))
})

// ── 其他退料「退到仓库」可自选(2026-11-19 用户口径)──────────────────────────

test('toWarehouseOptions:停用仓不进下拉', () => {
  const rows = [
    { 仓库编码: 'CK00006', 仓库名称: '华北工控仓', 停用: 0 },
    { 仓库编码: 'CK00005', 仓库名称: '原料不良品仓', 停用: false },
    { 仓库编码: 'CK01', 仓库名称: '原料仓', 停用: 1 },
    { 仓库编码: 'CK02', 仓库名称: '辅料仓', 停用: '1' },
    { 仓库编码: 'CK03', 仓库名称: '成品仓', 停用: true },
    { 仓库编码: 'CK04', 仓库名称: '半成品仓', 停用: '是' },
    { 仓库编码: '', 仓库名称: '空编码', 停用: 0 },
    { 仓库编码: 'CK-A', 仓库名称: 'A仓' },              // 字段缺失 = 启用,不误杀
    { 仓库编码: 'CK-C' },                                 // 没名称就用编码顶上
  ]
  assert.deepEqual(toWarehouseOptions(rows), [
    { code: 'CK00006', name: '华北工控仓' },
    { code: 'CK00005', name: '原料不良品仓' },
    { code: 'CK-A', name: 'A仓' },
    { code: 'CK-C', name: 'CK-C' },
  ])
  assert.deepEqual(toWarehouseOptions(null), [])
  assert.deepEqual(toWarehouseOptions([{}]), [])
})

test('defaultWarehouseCode:库存行有仓就用它,没有就留空逼现场选', () => {
  assert.equal(defaultWarehouseCode(cand()), 'CK00006')
  assert.equal(defaultWarehouseCode(cand({ 仓库编码: '  CK00005  ' })), 'CK00005')
  assert.equal(defaultWarehouseCode(cand({ 仓库编码: '', 仓库: '' })), '')
  assert.equal(defaultWarehouseCode(null), '')
})

test('withWarehouse:改仓要同时换掉 仓库名称 + 仓库编码', () => {
  const out = withWarehouse(cand(), { code: 'CK00005', name: '原料不良品仓' })
  assert.equal(out.仓库编码, 'CK00005')
  assert.equal(out.仓库, '原料不良品仓', '只写编码会让纸面「仓库」那格空着')
  assert.equal(out.批号, 'PC0000', '改仓不动批号')
  assert.equal(cand().仓库编码, 'CK00006', '入参不能被就地改掉')
  // 没选仓时原样返回(不能把仓库清成空)
  assert.equal(withWarehouse(cand(), null).仓库编码, 'CK00006')
  assert.equal(withWarehouse(cand(), { code: '  ' }).仓库编码, 'CK00006')
  // 只有编码没有名称 ⇒ 用编码兜底
  assert.equal(withWarehouse(cand(), { code: 'CK00005' }).仓库, 'CK00005')
})

test('改仓后退料单落的是选中的仓,同物料退两个仓 = 两行', () => {
  const lines = mergeLine([], withWarehouse(cand(), { code: 'CK00005', name: '原料不良品仓' }), 2, SIDE_RET).lines
  const form = buildMaterialRetForm(lines, { date: '2026-11-19' })
  assert.equal(form.detail.items[0].仓库编码, 'CK00005')
  assert.equal(form.detail.items[0].仓库, '原料不良品仓')

  const back = mergeLine(lines, cand(), 1, SIDE_RET).lines   // 原仓再退一条
  assert.equal(back.length, 2, '同一物料退到不同仓必须是两行,不能合并')
  assert.deepEqual(back.map((l) => l.warehouseCode), ['CK00005', 'CK00006'])
})

// ── 页面守卫:别在下次改版里把「退到仓库」又改回"库存没命中才让选"──────────────

const here = dirname(fileURLToPath(import.meta.url))
const vue = readFileSync(join(here, '../views/mobile/MobileOtherScan.vue'), 'utf8')
const en = readFileSync(join(here, '../i18n/locales/en.js'), 'utf8')

test('其他退料/领料页:退料一律给「退到仓库」,领料不给', () => {
  // 判定逻辑钉在 showWh:ret 恒真;pick 只保留"库存行没仓"的老兜底
  assert.match(vue, /if \(isReturn\.value\) return true/, '其他退料必须始终显示仓库下拉')
  assert.match(vue, /return !current\.value\['仓库'\] && !current\.value\['仓库编码'\]/,
    '其他领料只在库存行没有仓库时才需要手选')
  assert.match(vue, /v-if="showWh"/, '下拉必须挂在 showWh 上(别再冒出第二个条件)')
  // 加入清单时必须把选中的仓盖到候选行上,否则落库还是库存行的仓
  assert.match(vue, /withWarehouse\(c, \{ code: warehouseCode\.value, name: whNameOf\(warehouseCode\.value\) \}\)/,
    '加入清单必须用现场选的仓覆盖候选项')
  // 手选后粘住(同一批连着退同一个仓),提交/清空复位
  assert.match(vue, /if \(whTouched\.value\) return/, '手选过就不能再被库存行刷掉')
  assert.match(vue, /whTouched\.value = false/, '提交/清空后必须复位')
  // 退料一进页就把仓库档拉好,不能等"库存没命中"才拉
  assert.match(vue, /if \(isReturn\.value\) loadWarehouses\(\)/, '退料进页必须预拉仓库档案')
  assert.match(vue, /toWarehouseOptions\(/, '仓库下拉必须过滤停用仓')
})

test('其他退料/领料页:文案都有英文译名', () => {
  const keys = [...new Set([...vue.matchAll(/tt\('([^']+)'\)/g)].map((m) => m[1]))]
  assert.ok(keys.length > 30, '本页文案不该被抽空')
  const missing = keys.filter((k) => !en.includes("'" + k + "'") && !en.includes('"' + k + '"'))
  assert.deepEqual(missing, [], '这些文案缺英文译名: ' + missing.join(' / '))
})
