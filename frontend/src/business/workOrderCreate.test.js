/**
 * workOrderCreate.test.js — 生产工单「新增」整页编制纯逻辑单测(2026-11-13)
 *
 * 断言指向的都是**会和后端口径对不上就会坏**的点:
 *   · todayStr      → 本地日期,不能用 UTC(否则东八区凌晨把工单日期算成昨天)
 *   · blankForm / blankBomLine / nextLineSeq / renumberLines → 初始值与行序连续
 *   · mapStdBomLines→ 标准BOM(接口/表) 的行 → 本页明细行:行序重排、数值化、备注→行备注
 *   · lineProblem / validateWorkOrder → 契约里的每条校验及其**准确中文文案**
 *   · pickDefaultRoute → 只用「已审核」路线;产品档案优先,其次 options 默认
 *   · buildCreatePayload → POST create 的键名一字不差(契约 D)、常规工单不带明细、临时只落有编码的行
 *   · draftToState     → POST draft/get 的返回 → 页面状态(继续编辑草稿的回填口径)
 *   · buildDraftPayload→ POST draft/save 的键名一字不差、草稿id 0/覆盖、常规清空明细
 *   · formSnapshot     → 离开守卫的脏检查:与保存口径同源,trim/数值差异不算脏
 *
 * ⚠ 数量口径(2026-11-13 第二轮用户反馈):**手工新增的工单没有销售订单** ⇒ 页面/请求体/校验
 *   只有「生产数量」一个数量,`订单数量` 既不显示、不校验、也不发送(旧草稿里的残留值忽略)。
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
  buildDraftPayload,
  draftToState,
  formSnapshot,
  lineProblem,
  mapStdBomLines,
  nextLineSeq,
  pickDefaultRoute,
  renumberLines,
  todayStr,
  validateWorkOrder,
} from './workOrderCreate.js'

/** 契约 D 的顶层键(顺序也按契约写,提交给后端的键名一个字都不许改)
 *  ⚠ 没有 `订单数量`:手工新增单没有销售订单,只发 生产数量(2026-11-13 用户口径) */
const PAYLOAD_KEYS = [
  '工单类型', '产品编码', '客户编码', '客户名称', '生产数量',
  '工单日期', '计划开工日期', '交期', '工艺路线', '备注', '物料清单',
]
/** 契约 D 的明细行键 */
const LINE_KEYS = ['行序', '子件编码', '子件名称', '子件规格', '计量单位', '标准用量', '损耗量', '行备注']
/** 契约 `/draft/save` 的顶层键(顺序也按契约写:草稿id 在最前,后端按它判新建/覆盖;同样没有 订单数量) */
const DRAFT_PAYLOAD_KEYS = [
  '草稿id', '工单类型', '产品编码', '产品名称', '规格型号', '计量单位',
  '客户编码', '客户名称', '生产数量',
  '工单日期', '计划开工日期', '交期', '工艺路线', '备注', '物料清单',
]

/** 一份能通过校验的常规工单表单(只有 生产数量 一个数量) */
const okForm = () => ({
  产品编码: 'A-48-01', 产品名称: '炭棒', 规格型号: '48*120', 计量单位: '支',
  客户编码: 'A-26', 客户名称: '宁波某某',
  生产数量: 100,
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
test('blankForm:工单日期默认今天,其余留空,支持覆盖;没有 订单数量 字段', () => {
  const f = blankForm()
  assert.equal(f.工单日期, todayStr())
  assert.equal(f.产品编码, '')
  assert.equal(f.客户编码, '')
  assert.equal(f.工艺路线, '')
  assert.equal(f.生产数量, undefined)
  assert.ok(!('订单数量' in f), '手工新增单没有销售订单 ⇒ 表单里不该再有 订单数量')
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

  // 唯一数量 = 生产数量:缺了它就是拦(订单数量已不再参与校验)
  const noProduce = validateWorkOrder({ form: { ...okForm(), 生产数量: undefined } })
  assert.equal(noProduce.ok, false)
  assert.equal(noProduce.message, '生产数量必须大于 0')
  assert.equal(noProduce.field, '生产数量')
  assert.equal(noProduce.reason, 'positive')
  // 表单里没有 订单数量 也照样通过 —— 手工单本来就没有销售订单
  assert.equal(validateWorkOrder({ form: okForm() }).ok, true)

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
test('buildCreatePayload:顶层/明细键名严格按契约 D,常规工单不带明细,不发 订单数量', () => {
  const p = buildCreatePayload(okForm(), [okLine()], KIND_NORMAL)
  assert.deepEqual(Object.keys(p), PAYLOAD_KEYS)
  assert.equal(p.工单类型, '常规')
  assert.equal(p.产品编码, 'A-48-01')
  assert.equal(p.客户编码, 'A-26')
  assert.equal(p.客户名称, '宁波某某')
  assert.ok(!('订单数量' in p), '手工新增单没有销售订单 ⇒ 请求体不发 订单数量(后端按生产数量兜底)')
  assert.equal(p.生产数量, 100)
  assert.equal(p.工单日期, '2026-11-13')
  assert.equal(p.计划开工日期, '2026-11-14')
  assert.equal(p.交期, '2026-11-20')
  assert.equal(p.工艺路线, 'GY-CB-STD')
  assert.deepEqual(p.物料清单, [], '常规工单不写 wo_bom')
  // 就算调用方手里还留着旧的 订单数量(例如从老弹窗代码/旧草稿传进来),也不许被带进请求体
  assert.ok(!('订单数量' in buildCreatePayload({ ...okForm(), 订单数量: 999 }, [], KIND_NORMAL)))
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
  assert.equal(p.生产数量, 0)
  assert.ok(!('订单数量' in p), '空表单同样不发 订单数量')
  assert.equal(p.产品编码, '')
  assert.equal(p.工单日期, '')
  assert.equal(p.物料清单.length, 0)
  assert.ok(!JSON.stringify(p).includes('null'), 'JSON 里不许出现 null(后端按空串/0 处理更稳)')
})

// ════════════════════════════════════════════════════════════════════════════════
// 草稿(方案 A,2026-11-13):draft/get → 页面状态 → draft/save → 快照脏检查
// ════════════════════════════════════════════════════════════════════════════════

// ── 草稿:接口返回 → 页面状态 ──────────────────────────────────────────────────────
test('draftToState:表头回填 + 临时页签 + 明细行序重排/数值化/备注落行备注', () => {
  const st = draftToState({
    草稿id: 12, 草稿号: 'GDD-2026-11-0001', 工单类型: '临时', 状态: '草稿',
    产品编码: ' A-32-01 ', 产品名称: 'S阻垢炭棒', 规格型号: '40.5*16*80', 计量单位: '支',
    客户编码: 'A-26', 客户名称: '宁波某某',
    订单数量: '10', 生产数量: 12,
    工单日期: '2026-11-13', 计划开工日期: '', 交期: '2026-11-20',
    工艺路线: 'GY-CB-STD', 备注: '',
    物料清单: [
      { 行序: 5, 子件编码: ' M-001 ', 子件名称: '炭粉', 子件规格: '320目', 计量单位: 'kg', 标准用量: '2.5', 损耗量: '0.3', 行备注: '首批' },
      { 行序: 9, 子件编码: 'M-002', 子件名称: '胶粉', 子件规格: '', 计量单位: 'kg', 备注: '标准BOM叫法' },
    ],
  })
  assert.equal(st.kind, KIND_TEMP)
  assert.equal(st.form.产品编码, 'A-32-01')
  assert.equal(st.form.产品名称, 'S阻垢炭棒')
  assert.equal(st.form.客户编码, 'A-26')
  assert.equal(st.form.生产数量, 12)
  assert.ok(!('订单数量' in st.form), '草稿里的旧 订单数量 不再回填(手工单没有销售订单)')
  assert.equal(st.form.工单日期, '2026-11-13')
  assert.equal(st.form.计划开工日期, '')
  assert.deepEqual(st.lines.map((r) => r.行序), [1, 2], '草稿里存的断号要重排 1..n')
  assert.deepEqual(Object.keys(st.lines[0]), LINE_KEYS)
  assert.equal(st.lines[0].子件编码, 'M-001')
  assert.equal(st.lines[0].标准用量, 2.5)
  assert.equal(st.lines[0].行备注, '首批')
  assert.equal(st.lines[1].标准用量, 1, '草稿行没给标准用量 ⇒ 按新增行默认 1')
  assert.equal(st.lines[1].行备注, '标准BOM叫法', '草稿行的 备注 落到本页 行备注')
})

test('draftToState:缺字段保留 blankForm 默认;生产数量空 = undefined;未知类型 = 常规;null 安全', () => {
  const st = draftToState({ 草稿id: 3, 工单日期: '', 订单数量: '', 生产数量: null })
  assert.equal(st.kind, KIND_NORMAL, '工单类型空/未知一律常规(与后端「空=常规」同口径)')
  assert.deepEqual(st.lines, [])
  assert.equal(st.form.工单日期, '', '草稿明确给了空串 ⇒ 就是空(不拿今天覆盖)')
  assert.equal(st.form.生产数量, undefined, '数量空 ⇒ 页面留空让用户填,不是 0')
  assert.ok(!('订单数量' in st.form))
  assert.equal(st.form.工艺路线, '', '接口没给的字段保留默认')
  assert.equal(st.form.产品编码, '')
  // 旧草稿只有 订单数量、没有 生产数量 ⇒ 生产数量留空(不拿 订单数量 冒充,用户自己填)
  const old = draftToState({ 草稿id: 4, 订单数量: 10 })
  assert.equal(old.form.生产数量, undefined)
  assert.ok(!('订单数量' in old.form))
  const bad = draftToState(null)
  assert.equal(bad.kind, KIND_NORMAL)
  assert.deepEqual(bad.lines, [])
  assert.equal(bad.form.产品编码, '')
  assert.equal(bad.form.工单日期, todayStr())
})

// ── 草稿:页面状态 → draft/save 请求体 ────────────────────────────────────────────
test('buildDraftPayload:键名严格按契约(草稿id 在最前),新草稿 = 0,存展示用档案字段,不发 订单数量', () => {
  const p = buildDraftPayload(okForm(), [okLine()], KIND_NORMAL)
  assert.deepEqual(Object.keys(p), DRAFT_PAYLOAD_KEYS)
  assert.equal(p.草稿id, 0, '新草稿固定传 0(后端据此取 GDD 号)')
  assert.equal(p.工单类型, '常规')
  assert.equal(p.产品名称, '炭棒', '草稿要存展示用档案字段(草稿箱列表直接显示)')
  assert.equal(p.规格型号, '48*120')
  assert.equal(p.计量单位, '支')
  assert.ok(!('订单数量' in p), '草稿同样不发 订单数量')
  assert.equal(p.生产数量, 100)
  assert.deepEqual(p.物料清单, [], '常规工单忽略/清空物料清单')
  // 已有草稿:'12' 这种字符串 id 要数值化,不能原样把 '12' 发过去
  assert.equal(buildDraftPayload(okForm(), [], KIND_NORMAL, '12').草稿id, 12)
  assert.equal(buildDraftPayload(okForm(), [], KIND_NORMAL, -1).草稿id, 0, '非法 id 落回 0(当新建),不写坏数据')
})

test('buildDraftPayload:临时工单只落有编码的行,行序重排 + 与 create 同一份明细键名', () => {
  const lines = [
    okLine({ 行序: 5, 子件编码: ' M-001 ', 标准用量: '2.5', 损耗量: '0.25', 行备注: ' 首批 ' }),
    { 行序: 6 },
    okLine({ 行序: 7, 子件编码: 'M-002', 标准用量: '', 损耗量: null }),
  ]
  const p = buildDraftPayload({ ...okForm(), 备注: '急单' }, lines, KIND_TEMP, 12)
  assert.equal(p.草稿id, 12)
  assert.equal(p.工单类型, '临时')
  assert.equal(p.物料清单.length, 2)
  assert.deepEqual(Object.keys(p.物料清单[0]), LINE_KEYS)
  assert.deepEqual(p.物料清单.map((r) => r.行序), [1, 2])
  assert.equal(p.物料清单[0].子件编码, 'M-001')
  assert.equal(p.物料清单[0].标准用量, 2.5)
  assert.equal(p.物料清单[0].行备注, '首批')
  // 空表单也要能安全序列化(草稿存坏存一律不许出 undefined/NaN)
  const empty = buildDraftPayload({}, [], KIND_NORMAL)
  assert.equal(empty.生产数量, 0)
  assert.ok(!('订单数量' in empty))
  assert.ok(!JSON.stringify(empty).includes('null'))
})

// ── 快照:离开守卫的脏检查 ────────────────────────────────────────────────────────
test('formSnapshot:同内容 = 同快照;trim 不算脏;改数量/改行/切类型算脏', () => {
  const s1 = formSnapshot(okForm(), [okLine()], KIND_TEMP)
  assert.equal(formSnapshot(okForm(), [okLine()], KIND_TEMP), s1, '同样的内容必须得到同一个快照')
  // 首尾空格 / 数量写成字符串:存下来是同一份内容 ⇒ 不算脏(不该拦用户)
  assert.equal(formSnapshot({ ...okForm(), 产品编码: ' A-48-01 ' }, [okLine()], KIND_TEMP), s1)
  assert.equal(formSnapshot({ ...okForm(), 生产数量: '100' }, [okLine()], KIND_TEMP), s1)
  // 真改了东西 ⇒ 快照必须变(否则离开时静默丢数据)
  assert.notEqual(formSnapshot({ ...okForm(), 备注: '改一句' }, [okLine()], KIND_TEMP), s1)
  assert.notEqual(formSnapshot({ ...okForm(), 生产数量: 101 }, [okLine()], KIND_TEMP), s1)
  assert.notEqual(formSnapshot(okForm(), [okLine({ 标准用量: 3 })], KIND_TEMP), s1, '明细行改动算脏')
  assert.notEqual(formSnapshot(okForm(), [okLine(), okLine({ 子件编码: 'M-002' })], KIND_TEMP), s1, '加一行算脏')
  assert.notEqual(formSnapshot(okForm(), [okLine()], KIND_NORMAL), s1, '切换常规/临时算脏(保存的内容变了)')
  // 常规工单不看明细:同一份表头下改明细不算脏(与后端「常规忽略物料清单」一致)
  const n1 = formSnapshot(okForm(), [], KIND_NORMAL)
  assert.equal(formSnapshot(okForm(), [okLine()], KIND_NORMAL), n1)
})
