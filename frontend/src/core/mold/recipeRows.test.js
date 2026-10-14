import test from 'node:test'
import assert from 'node:assert/strict'
import { NO_RECIPE_ROWS, groupOfMaterialType, paramsFromHead, slotsFromRows, unfilledDesignRows } from './recipeSheet.js'
import { blankRecipeRow, buildRecipeRows, editRowsFrom, invFillFor, invOptionsOf, uniqueInvRowOf } from './recipeRows.js'

/**
 * 配方计算弹窗「物料行」编辑(2026-10-15 用户口径变更)。
 *
 * 用户原话:「成型工艺清单的配方表的数据是在配方计算器里面填写数据然后填入单据的,
 *   **而不是带入的规格书的**」+ 追问确认:**在弹窗里录物料行**。
 * 于是:判据从"页 2 配方表有没有行"变成"**弹窗里这份行**有没有行",算完连行一起写回页 2。
 *
 * 这些断言钉的就是这次口径变更的可测部分(纯函数层):
 *   · 弹窗行的**初始来源**(页 2 已有行 → 带进来接着编;页 2 空 → 从零加);
 *   · 写回页 2 的**整表替换**内容(空行剔除、序号重排、算出的两列并进去);
 *   · 两道输入闸(NO_RECIPE_ROWS 阻断 / 未填设计添加量告警)的判据**跟着弹窗这份行走**。
 * 期望值按"引擎真正吃到的数"写,不照实现反填。
 */

/** 造一行页 2 配方表行(照单据里真实的数据键) */
const page2Row = (kind, code, design, extra = {}) => ({
  表区: '配方表', 序号: '', 物料种类: kind, 物料编号: code, 物料名称: `${code}名`, 设计添加量: design, ...extra,
})
const headOK = { 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120', 实际密度管控下限: '0.58', 实际密度管控上限: '0.60' }
const OPTS = { cavities: 1, conversion_ratio: 0.5 }

/* ── 初始来源:页 2 已有行 / 页 2 为空,两个入口都要走通 ───────────────────────────── */

test('弹窗行初始来源 · 页 2 有行 ⇒ 原样带进来接着编(且是拷贝,弹窗里改不动物单据)', () => {
  const rows = [page2Row('炭粉', 'A', '0.5', { 实际添加比例: '12.00%' }), page2Row('胶粉', 'C', '')]
  const edit = editRowsFrom(rows)
  assert.deepEqual(edit, rows, '页 2 的行原样进弹窗(键逐字相同,不另立一套键)')
  assert.notEqual(edit[0], rows[0], '是拷贝 —— 弹窗里改不应该在点「填入单据」前就动到单据')
  edit[0]['设计添加量'] = '0.9'
  assert.equal(rows[0]['设计添加量'], '0.5', '改弹窗行不许透过引用改到单据上那一行')
})

test('弹窗行初始来源 · 页 2 为空 ⇒ 从零开始(空数组,不是一行空白行)', () => {
  assert.deepEqual(editRowsFrom([]), [])
  assert.deepEqual(editRowsFrom(null), [])
  assert.deepEqual(Object.keys(blankRecipeRow()).sort(),
    ['设计添加量', '物料名称', '物料种类', '物料编号'].sort(), '新行只带四个输入格')
})

/* ── 写回页 2:整表替换的内容 ──────────────────────────────────────────────────── */

test('写回 · 只写有物料的行(整行空白的行不落库),序号按新次序 1..N 重排', () => {
  const edit = [blankRecipeRow(), page2Row('炭粉', 'A', '1'), blankRecipeRow(), page2Row('胶粉', 'C', '0.5')]
  const out = buildRecipeRows(edit, [])
  assert.equal(out.length, 2, '两行空行被剔除(明细表天生会留空行)')
  assert.deepEqual(out.map((r) => r['序号']), ['1', '2'], '序号按写回后的次序重排,不留 1/3 这种断号')
  assert.equal(out[0]['物料编号'], 'A')
  assert.equal(out[1]['物料编号'], 'C')
})

test('写回 · 算出的两列并进对应行(按行号对齐),行上原有的其它键(表区等)保留', () => {
  const edit = [page2Row('炭粉', 'A', '1'), page2Row('胶粉', 'C', '0.5')]
  const patchRows = [
    { rowIndex: 0, code: 'A', 实际添加比例: '80.00%', 单支物料含量: '1.23' },
    { rowIndex: 1, code: 'C', 实际添加比例: '20.00%', 单支物料含量: '0.31' },
  ]
  const out = buildRecipeRows(edit, patchRows)
  assert.equal(out[0]['实际添加比例'], '80.00%')
  assert.equal(out[1]['单支物料含量'], '0.31')
  assert.equal(out[0]['表区'], '配方表', '本表区的行标(表区)不许被抹掉 —— 抹了这行就不属于配方表了')
})

test('写回 · 被引擎忽略的行(超出料位容量)保留原值,不写 undefined 也不丢行', () => {
  const edit = [page2Row('炭粉', 'A', '1', { 实际添加比例: '50.00%', 单支物料含量: '0.50' }),
    page2Row('炭粉', 'F', '0.2', { 实际添加比例: '9.99%', 单支物料含量: '0.09' })]
  const out = buildRecipeRows(edit, [{ rowIndex: 0, code: 'A', 实际添加比例: '100.00%', 单支物料含量: '1.00' }])
  assert.equal(out.length, 2, '没参与计算的行也是用户录的数据,不许被吞掉')
  assert.equal(out[0]['实际添加比例'], '100.00%', '参与计算的行被新值覆盖')
  assert.equal(out[1]['实际添加比例'], '9.99%', '没参与计算的行保留上一次的值(不给 undefined/空)')
})

/* ── 两道输入闸:判据跟着**弹窗里这份行**走(本次口径变更的核心) ────────────────── */

test('口径变更 · 页 2 空但弹窗里录了行 ⇒ 不阻断(NO_RECIPE_ROWS 不许再按页 2 判)', () => {
  const dialogRows = editRowsFrom([])
  assert.ok(paramsFromHead(headOK, OPTS, dialogRows).missing.includes(NO_RECIPE_ROWS),
    '弹窗一行物料都没有 ⇒ 阻断(这是唯一没有歧义的拦法)')
  dialogRows.push({ ...blankRecipeRow(), 物料种类: '炭粉', 物料编号: 'A', 设计添加量: '1' })
  const { params, missing } = paramsFromHead(headOK, OPTS, dialogRows)
  assert.deepEqual(missing, [], '在弹窗里录了行 ⇒ 必须放行,页 2 是不是空的与本次计算无关')
  assert.equal(params.length, 120, '页 2 是空的也一样算得出来(尺寸/密度齐)')
})

test('口径变更 · 「设计添加量」为空那条告警也判在弹窗这份行上(行号就是弹窗里的行号)', () => {
  const dialogRows = [page2Row('炭粉', 'A', ''), page2Row('炭粉', 'B', ''), page2Row('炭粉', 'E', '0.2')]
  const { slots } = slotsFromRows(dialogRows)
  assert.deepEqual(unfilledDesignRows(dialogRows, slots), [2], '第 2 行(弹窗里第 2 行)空着 ⇒ 点名;第 1 行是补差位不点名')
})

/* ── 商品档案:填编号带出名称/种类(只补空格,不覆盖人填的值) ────────────────────── */

test('按编号带出 · 商品档案只补空格(已有值不动),所属类别不在词表里就不补', () => {
  const inv = { 存货编码: 'M-001', 存货名称: '炭纤维', 所属类别: '功能料-颗粒' }
  assert.deepEqual(invFillFor({ 物料编号: 'M-001' }, inv), { 物料名称: '炭纤维', 物料种类: '功能料-颗粒' })
  assert.deepEqual(invFillFor({ 物料编号: 'M-001', 物料名称: '手填的名' }, inv), { 物料种类: '功能料-颗粒' },
    '人已经填了的格不许被档案覆盖')
  assert.deepEqual(invFillFor({ 物料编号: 'M-001', 物料种类: '炭粉' }, inv), { 物料名称: '炭纤维' })
  assert.deepEqual(invFillFor({ 物料编号: 'M-001' }, { 存货编码: 'M-001', 存货名称: '', 所属类别: '其它类别' }), {},
    '档案里没有名称 / 类别不是引擎认的词 ⇒ 什么都不补(不猜)')
})

test('按编号带出 · 档案里的「折算物料」(M-001 炭棒 / M-003 炭纤维 的实际类别)必须带得出来', () => {
  // 2026-10-15:bs_inv.所属类别 实测值域 8 类,工艺员要录的 M-001/M-003 都是「折算物料」;
  // 引擎 groupOfMaterialType 显式认它(归折算料位 8~10),以前因为词表只有四个词而带不出来。
  const inv = { 存货编码: 'M-001', 存货名称: '炭棒', 所属类别: '折算物料' }
  assert.deepEqual(invFillFor({ 物料编号: 'M-001' }, inv), { 物料名称: '炭棒', 物料种类: '折算物料' })
  assert.deepEqual(invFillFor({ 物料编号: 'M-003', 物料种类: '炭粉' }, { 存货编码: 'M-003', 存货名称: '炭纤维', 所属类别: '折算物料' }),
    { 物料名称: '炭纤维' }, '手填过的种类仍然不许被覆盖')
  assert.equal(groupOfMaterialType('折算物料'), '折算料', '前提:引擎确实认这个词(不认就不该带出)')
})

/* ── 「物料编号」下拉的选项与唯一命中判据(2026-10-15 用户口径:手打太慢,改成从商品档案里挑) ── */

test('编号下拉选项 · 由商品档案行生成:值=存货编码,显示「编码 — 名称」,保序', () => {
  const rows = [{ 存货编码: 'M-001', 存货名称: '炭棒' }, { 存货编码: 'M-003', 存货名称: '炭纤维' }]
  assert.deepEqual(invOptionsOf(rows), [
    { value: 'M-001', label: 'M-001 — 炭棒' },
    { value: 'M-003', label: 'M-003 — 炭纤维' },
  ], '保档案返回的原序,不另排序(排序是显示偏好,不该由这个纯函数偷偷定)')
})

test('编号下拉选项 · 空编码不出现、空名称只显示编码、同码去重、非数组给空', () => {
  const rows = [
    { 存货编码: '  M-001  ', 存货名称: '  炭棒  ' },
    { 存货编码: '', 存货名称: '没编码的不算物料' },
    { 存货编码: null, 存货名称: '同上' },
    { 存货编码: 'M-001', 存货名称: '重码的第二条' },
    { 存货编码: 'PS-3', 存货名称: '' },
  ]
  assert.deepEqual(invOptionsOf(rows), [
    { value: 'M-001', label: 'M-001 — 炭棒' },
    { value: 'PS-3', label: 'PS-3' },
  ], '空编码的档案行不是可选的物料;重码只留第一条(下拉里同值两项会让人以为选错了)')
  assert.deepEqual(invOptionsOf(null), [])
  assert.deepEqual(invOptionsOf(undefined), [])
  assert.deepEqual(invOptionsOf('不是数组'), [])
})

test('唯一命中判据 · trim 后全等才算命中,查不到/多条都给 null(宁可不带,不带错)', () => {
  const rows = [{ 存货编码: 'M-001', 存货名称: '炭棒' }, { 存货编码: 'XM-001', 存货名称: '别的料' }]
  assert.equal(uniqueInvRowOf(rows, 'M-001')?.['存货名称'], '炭棒')
  assert.equal(uniqueInvRowOf(rows, '  M-001  ')?.['存货名称'], '炭棒', '前后空格要能容忍')
  assert.equal(uniqueInvRowOf(rows, 'M-002'), null, '档案里没有 ⇒ null(调用方据此保留手输值)')
  assert.equal(uniqueInvRowOf(rows, '001'), null,
    '不许按子串命中:后端 condition 对普通文本走 LIKE,`M-001` 会带回 `XM-001` —— 判等在本地收紧')
  assert.equal(uniqueInvRowOf([...rows, { 存货编码: 'M-001', 存货名称: '重码' }], 'M-001'), null,
    '同一编码两条 ⇒ 不猜哪条对,谁也不带')
  assert.equal(uniqueInvRowOf(rows, ''), null)
  assert.equal(uniqueInvRowOf(rows, null), null)
  assert.equal(uniqueInvRowOf(null, 'M-001'), null)
})

test('下拉选中 → 带出:选项由档案生成、按选中编码取唯一命中、折算物料也照样带出来', () => {
  // 这条把"选项怎么来"和"选中后带出什么"串起来(弹窗里 onMaterialCodeChange 的判据链):
  const archive = [
    { 存货编码: 'M-001', 存货名称: '炭棒', 所属类别: '折算物料' },
    { 存货编码: 'YJ-XH-001', 存货名称: '专用炭X5', 所属类别: '炭粉' },
  ]
  const options = invOptionsOf(archive)
  const picked = options.find((o) => o.label.includes('炭棒'))   // 用户在下拉里挑中的那项
  assert.equal(picked.value, 'M-001', '下拉的值就是可写进单据的 物料编号')
  const inv = uniqueInvRowOf(archive, picked.value)
  assert.deepEqual(invFillFor({ 物料编号: picked.value }, inv), { 物料名称: '炭棒', 物料种类: '折算物料' },
    '选中一条 ⇒ 名称与种类都带出来(折算物料不再因为词表缺词而丢掉)')
  assert.equal(uniqueInvRowOf(archive, 'M-999'), null, 'allow-create 手打的新编码 ⇒ 档案查不到,什么都不动')
})
