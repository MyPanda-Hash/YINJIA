/**
 * workOrderCreate.test.js — 生产工单「新增」弹窗纯逻辑单测(2026-11-13)
 *
 * 断言指向的都是**会和后端口径对不上就会坏**的点:
 *   · todayStr      → 本地日期,不能用 UTC(否则东八区凌晨把工单日期算成昨天)
 *   · blankForm / blankBomLine / nextLineSeq / renumberLines → 弹窗初始值与行序连续
 *   · mapStdBomLines→ 标准BOM(接口/表) 的行 → 本弹窗明细行:行序重排、数值化、备注→行备注
 *   · lineProblem / validateWorkOrder → 契约里的每条校验及其**准确中文文案**
 *   · pickDefaultRoute → 只用「已审核」路线;产品档案优先,其次 options 默认
 *   · buildCreatePayload → POST create 的键名一字不差(契约 D)、常规工单不带明细、临时只落有编码的行
 *
 * 跑法:`cd frontend && node --test src/business/workOrderCreate.test.js`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KIND_NORMAL,
  KIND_TEMP,
  WORK_ORDER_PANEL,
  blankBomLine,
  blankForm,
  buildCreatePayload,
  lineProblem,
  mapStdBomLines,
  nextLineSeq,
  pickDefaultRoute,
  renumberLines,
  todayStr,
  validateWorkOrder,
} from './workOrderCreate.js'

/** 契约 D 的顶层键(顺序也按契约写,提交给后端的键名一个字都不许改) */
const PAYLOAD_KEYS = [
  '工单类型', '产品编码', '客户编码', '客户名称', '订单数量', '生产数量',
  '工单日期', '计划开工日期', '交期', '工艺路线', '备注', '物料清单',
]
/** 契约 D 的明细行键 */
const LINE_KEYS = ['行序', '子件编码', '子件名称', '子件规格', '计量单位', '标准用量', '损耗量', '行备注']

/** 一份能通过校验的常规工单表单 */
const okForm = () => ({
  产品编码: 'A-48-01', 产品名称: '炭棒', 规格型号: '48*120', 计量单位: '支',
  客户编码: 'A-26', 客户名称: '宁波某某',
  订单数量: 100, 生产数量: 100,
  工单日期: '2026-11-13', 计划开工日期: '2026-11-14', 交期: '2026-11-20',
  工艺路线: 'GY-CB-STD', 备注: '',
})

/** 一行能通过校验的临时工单用料 */
const okLine = (over = {}) => ({
  行序: 1, 子件编码: 'M-001', 子件名称: '炭粉', 子件规格: '320目',
  计量单位: 'kg', 标准用量: 2, 损耗量: 0.1, 行备注: '', ...over,
})

// ── 常量:数据键永远中文(ADR-0001),面板码用于 /px/invOptions 授权 ────────────────────
test('常量:页签存储值中文、面板码 = WORK_ORDER_LIST', () => {
  assert.equal(KIND_NORMAL, '常规')
  assert.equal(KIND_TEMP, '临时')
  assert.equal(WORK_ORDER_PANEL, 'WORK_ORDER_LIST')
})

// ── 今天:本地日期,补零,非法值安全 ────────────────────────────────────────────────
test('todayStr:本地日期(不是 UTC),个位数月/日补零', () => {
  assert.equal(todayStr(new Date(2026, 10, 13)), '2026-11-13')
  assert.equal(todayStr(new Date(2026, 0, 5)), '2026-01-05')
  // 本地 00:30 用 toISOString() 会掉到前一天 —— 这里必须仍是当天
  assert.equal(todayStr(new Date(2026, 10, 13, 0, 30)), '2026-11-13')
  assert.equal(todayStr(new Date('not-a-date')), '')
  // 默认参数 = 现在:至少是个合法的 yyyy-MM-dd
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/)
})

// ── 表单/行初始值 ──────────────────────────────────────────────────────────────────
test('blankForm:工单日期默认今天,其余留空,支持覆盖', () => {
  const f = blankForm()
  assert.equal(f.工单日期, todayStr())
  assert.equal(f.产品编码, '')
  assert.equal(f.客户编码, '')
  assert.equal(f.工艺路线, '')
  assert.equal(f.订单数量, undefined)
  assert.equal(blankForm({ 产品编码: 'X-1' }).产品编码, 'X-1')
})

test('blankBomLine:标准用量默认 1、损耗量默认 0、空编码;行序兜底 1', () => {
  const l = blankBomLine(3)
  assert.deepEqual(l, {
    行序: 3, 子件编码: '', 子件名称: '', 子件规格: '', 计量单位: '',
    标准用量: 1, 损耗量: 0, 行备注: '',
  })
  assert.equal(blankBomLine().行序, 1)
  assert.equal(blankBomLine(0).行序, 1)
})

test('nextLineSeq:空表 = 1,取最大行序 + 1,容忍脏值', () => {
  assert.equal(nextLineSeq([]), 1)
  assert.equal(nextLineSeq(null), 1)
  assert.equal(nextLineSeq([{ 行序: 1 }, { 行序: 7 }]), 8)
  assert.equal(nextLineSeq([{ 行序: 'abc' }, { 行序: 2 }]), 3)
})

test('renumberLines:重排成 1..n,不改入参', () => {
  const src = [{ 行序: 9, 子件编码: 'A' }, { 行序: 20, 子件编码: 'B' }]
  const out = renumberLines(src)
  assert.deepEqual(out.map((r) => r.行序), [1, 2])
  assert.deepEqual(out.map((r) => r.子件编码), ['A', 'B'])
  assert.equal(src[0].行序, 9, '入参不许被改动')
  assert.deepEqual(renumberLines(null), [])
})

// ── 标准BOM → 明细行 ──────────────────────────────────────────────────────────────
test('mapStdBomLines:行序重排 + 数值化 + 备注落 行备注 + trim', () => {
  const out = mapStdBomLines({
    来源: '标准BOM', 单据编号: 'BOM-1', 版本号: 'V2',
    行: [
      { 行序: 0, 子件编码: ' M-001 ', 子件名称: '炭粉', 子件规格: '320目', 计量单位: 'kg', 标准用量: '2.5', 损耗量: '0.3', 备注: '首批' },
      { 行序: 5, 子件编码: 'M-002', 子件名称: '胶粉', 子件规格: '', 计量单位: 'kg', 标准用量: 1, 损耗量: null },
    ],
  })
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((r) => r.行序), [1, 2])
  assert.deepEqual(Object.keys(out[0]), LINE_KEYS)
  assert.equal(out[0].子件编码, 'M-001')
  assert.equal(out[0].标准用量, 2.5)
  assert.equal(out[0].损耗量, 0.3)
  assert.equal(out[0].行备注, '首批', '标准BOM 的「备注」要落到本表的「行备注」')
  assert.equal(out[1].损耗量, 0)
  assert.equal(out[1].行备注, '')
})

test('mapStdBomLines:标准用量缺失按 1,明确的 0 原样保留;空返回 = []', () => {
  const out = mapStdBomLines({ 行: [{ 子件编码: 'A' }, { 子件编码: 'B', 标准用量: 0 }] })
  assert.equal(out[0].标准用量, 1)
  assert.equal(out[1].标准用量, 0, '显式 0 不替用户改数,交给校验点名')
  assert.deepEqual(mapStdBomLines({ 来源: '', 行: [] }), [])
  assert.deepEqual(mapStdBomLines(null), [])
  assert.deepEqual(mapStdBomLines([{ 子件编码: 'C', 标准用量: 3 }]).map((r) => r.行序), [1])
})

// ── 单行判定 ──────────────────────────────────────────────────────────────────────
test('lineProblem:子件编码/标准用量/计量单位 三条,合法返回 null', () => {
  assert.equal(lineProblem(okLine()), null)
  assert.deepEqual(lineProblem({ 标准用量: 1, 计量单位: 'kg' }), { field: '子件编码', reason: 'required' })
  assert.deepEqual(lineProblem({ 子件编码: 'M-1', 标准用量: 0, 计量单位: 'kg' }), { field: '标准用量', reason: 'positive' })
  assert.deepEqual(lineProblem({ 子件编码: 'M-1', 标准用量: -1, 计量单位: 'kg' }), { field: '标准用量', reason: 'positive' })
  assert.deepEqual(lineProblem({ 子件编码: 'M-1', 标准用量: 1, 计量单位: '  ' }), { field: '计量单位', reason: 'required' })
})

// ── 主数据校验:文案必须是契约里那几句(组件直接 tt() 上屏) ────────────────────────────
test('validateWorkOrder:常规工单逐条校验与文案', () => {
  assert.equal(validateWorkOrder({ kind: KIND_NORMAL, form: okForm() }).ok, true)

  const noProduct = validateWorkOrder({ form: { ...okForm(), 产品编码: ' ' } })
  assert.equal(noProduct.ok, false)
  assert.equal(noProduct.message, '请选择主物料')

  const noOrder = validateWorkOrder({ form: { ...okForm(), 订单数量: 0 } })
  assert.equal(noOrder.message, '订单数量必须大于 0')
  const noProduce = validateWorkOrder({ form: { ...okForm(), 生产数量: undefined } })
  assert.equal(noProduce.message, '生产数量必须大于 0')

  const noRoute = validateWorkOrder({ form: { ...okForm(), 工艺路线: '' } })
  assert.equal(noRoute.message, '请选择工艺路线')

  // 常规工单不看明细:哪怕传了一堆空行也照样通过
  assert.equal(validateWorkOrder({ kind: KIND_NORMAL, form: okForm(), lines: [{}] }).ok, true)
})

test('validateWorkOrder:工艺路线必须已审核(传了 routes 才核)', () => {
  const routes = [
    { 编码: 'GY-CB-STD', 名称: '炭棒标准', 审核状态: '已审核' },
    { 编码: 'GY-NEW', 名称: '新线', 审核状态: '未审核' },
  ]
  assert.equal(validateWorkOrder({ form: okForm(), routes }).ok, true)
  const bad = validateWorkOrder({ form: { ...okForm(), 工艺路线: 'GY-NEW' }, routes })
  assert.equal(bad.ok, false)
  assert.equal(bad.message, '工艺路线尚未审核，不能用于生产工单')
  // 路线不在候选里(例如档案里已删)→ 不做审核判定,交给后端
  assert.equal(validateWorkOrder({ form: { ...okForm(), 工艺路线: 'GY-GONE' }, routes }).ok, true)
})

test('validateWorkOrder:临时工单至少一行,逐行点名(带行序)', () => {
  const base = { kind: KIND_TEMP, form: okForm() }
  const empty = validateWorkOrder(base)
  assert.equal(empty.ok, false)
  assert.equal(empty.message, '临时工单至少要填写一行所需物料（子件）')
  // 只有一行空白(刚点「添加行」)→ 仍算没填
  assert.equal(validateWorkOrder({ ...base, lines: [blankBomLine(1)] }).message, '临时工单至少要填写一行所需物料（子件）')

  assert.equal(validateWorkOrder({ ...base, lines: [okLine()] }).ok, true)

  // 第 2 行填了单位/用量、漏了编码 → 不算空行,点名到第 2 行
  const noCode = validateWorkOrder({ ...base, lines: [okLine(), { 行序: 2, 子件编码: '', 标准用量: 1, 计量单位: 'kg' }] })
  assert.equal(noCode.ok, false)
  assert.equal(noCode.lineNo, 2, '第 2 行的行序要点名,用户才知道去改哪行')
  assert.equal(noCode.field, '子件编码')
  assert.equal(noCode.reason, 'required')

  const badQty = validateWorkOrder({ ...base, lines: [okLine({ 标准用量: 0 })] })
  assert.equal(badQty.field, '标准用量')
  assert.equal(badQty.reason, 'positive')
  assert.equal(badQty.lineNo, 1)

  const badUnit = validateWorkOrder({ ...base, lines: [okLine({ 计量单位: '' })] })
  assert.equal(badUnit.field, '计量单位')
  assert.equal(badUnit.reason, 'required')

  // 合法行 + 多余空行 → 通过(空行不算"填了一行",提交时也自然被过滤)
  assert.equal(validateWorkOrder({ ...base, lines: [okLine(), blankBomLine(2)] }).ok, true)
})

// ── 默认工艺路线 ──────────────────────────────────────────────────────────────────
test('pickDefaultRoute:只认已审核;产品档案优先,其次 options 默认', () => {
  const routes = [
    { 编码: 'GY-P', 审核状态: '已审核' },
    { 编码: 'GY-D', 审核状态: '已审核' },
    { 编码: 'GY-X', 审核状态: '未审核' },
  ]
  assert.equal(pickDefaultRoute({ routes, productRoute: 'GY-P', fallback: 'GY-D' }), 'GY-P')
  assert.equal(pickDefaultRoute({ routes, productRoute: 'GY-X', fallback: 'GY-D' }), 'GY-D', '产品路线未审核 ⇒ 退默认')
  assert.equal(pickDefaultRoute({ routes, productRoute: '', fallback: 'GY-D' }), 'GY-D')
  assert.equal(pickDefaultRoute({ routes, productRoute: 'GY-X', fallback: 'GY-X' }), '', '都不合格宁可不预填')
  assert.equal(pickDefaultRoute({ routes: [], productRoute: 'GY-P', fallback: 'GY-D' }), '', '拿不到候选就无法确认审核状态')
  assert.equal(pickDefaultRoute(), '')
})

// ── 请求体(契约 D)────────────────────────────────────────────────────────────────
test('buildCreatePayload:顶层/明细键名严格按契约 D,常规工单不带明细', () => {
  const p = buildCreatePayload(okForm(), [okLine()], KIND_NORMAL)
  assert.deepEqual(Object.keys(p), PAYLOAD_KEYS)
  assert.equal(p.工单类型, '常规')
  assert.equal(p.产品编码, 'A-48-01')
  assert.equal(p.客户编码, 'A-26')
  assert.equal(p.客户名称, '宁波某某')
  assert.equal(p.订单数量, 100)
  assert.equal(p.生产数量, 100)
  assert.equal(p.工单日期, '2026-11-13')
  assert.equal(p.计划开工日期, '2026-11-14')
  assert.equal(p.交期, '2026-11-20')
  assert.equal(p.工艺路线, 'GY-CB-STD')
  assert.deepEqual(p.物料清单, [], '常规工单不写 wo_bom')
})

test('buildCreatePayload:临时工单只落有子件编码的行,行序重排、数值化、键名 行备注', () => {
  const lines = [
    okLine({ 行序: 5, 子件编码: ' M-001 ', 标准用量: '2.5', 损耗量: '0.25', 行备注: ' 首批 ' }),
    { 行序: 6 },                                  // 空行(没有子件编码)不落库
    okLine({ 行序: 7, 子件编码: 'M-002', 子件名称: '胶粉', 计量单位: 'kg', 标准用量: '', 损耗量: null }),
  ]
  const p = buildCreatePayload({ ...okForm(), 备注: '急单' }, lines, KIND_TEMP)
  assert.deepEqual(Object.keys(p), PAYLOAD_KEYS)
  assert.equal(p.工单类型, '临时')
  assert.equal(p.备注, '急单')
  assert.equal(p.物料清单.length, 2)
  assert.deepEqual(Object.keys(p.物料清单[0]), LINE_KEYS)
  assert.deepEqual(p.物料清单.map((r) => r.行序), [1, 2])
  assert.equal(p.物料清单[0].子件编码, 'M-001')
  assert.equal(p.物料清单[0].标准用量, 2.5)
  assert.equal(p.物料清单[0].损耗量, 0.25)
  assert.equal(p.物料清单[0].行备注, '首批')
  assert.equal(p.物料清单[1].标准用量, 0, '空用量按 0 提交,由后端/校验兜住')
  assert.equal(p.物料清单[1].损耗量, 0)
})

test('buildCreatePayload:空表单也能安全序列化(空串/0,不出现 undefined/NaN)', () => {
  const p = buildCreatePayload({}, [], KIND_NORMAL)
  assert.equal(p.订单数量, 0)
  assert.equal(p.生产数量, 0)
  assert.equal(p.产品编码, '')
  assert.equal(p.工单日期, '')
  assert.equal(p.物料清单.length, 0)
  assert.ok(!JSON.stringify(p).includes('null'), 'JSON 里不许出现 null(后端按空串/0 处理更稳)')
})
