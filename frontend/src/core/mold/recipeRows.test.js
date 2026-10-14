import test from 'node:test'
import assert from 'node:assert/strict'
import { NO_RECIPE_ROWS, paramsFromHead, slotsFromRows, unfilledDesignRows } from './recipeSheet.js'
import { blankRecipeRow, buildRecipeRows, editRowsFrom, invFillFor } from './recipeRows.js'

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
    '档案里没有名称 / 类别不是引擎认的那四个词 ⇒ 什么都不补(不猜)')
})
