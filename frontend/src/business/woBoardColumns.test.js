/**
 * woBoardColumns.test.js — 「工单排产」列设置渲染列序单测(2026-11-18)
 *
 * 钉住的边界(改这些等于改用户口径,先看 woBoardColumns.js 文件头三条硬口径):
 *   · 冻结区四列必须排在最前、且带 fixed:'left',草稿里被拖乱也不动;
 *   · 显隐按草稿走:隐藏的列不出、没进草稿的列(新加的列)默认可见(不静默丢列);
 *   · 日排产日期列整组由伪列控制:伪列可见才出、伪列位置决定整组插在哪;伪列隐藏 ⇒ 整组隐藏;
 *   · 草稿为空(首帧/没拉到设置)⇒ 默认全部可见 + 默认顺序 + 日期组落在锚点处。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAY_PLAN_COL_PROP,
  WO_BOARD_COLUMNS,
  WO_BOARD_DEFAULT_PINS,
  WO_BOARD_FROZEN_PROPS,
  boardColumnProps,
  boardRenderColumns,
  clampToScrollZone,
} from './woBoardColumns.js'

const DATES = ['2026-11-18', '2026-11-19']
const ALL = boardColumnProps()

/** 事先生成「全部可见、默认顺序」的草稿(等价 useReportColumns.init 之后) */
function defaultDraft() {
  return ALL.map((prop) => ({ prop, label: prop, visible: true }))
}

const propsOf = (list) => list.filter((c) => !c.date).map((c) => c.prop)
const datesOf = (list) => list.filter((c) => c.date).map((c) => c.date)

test('冻结区四列排在最前且带 fixed,与草稿顺序无关', () => {
  const draft = defaultDraft()
  // 故意把「客户」挪到最后 ⇒ 冻结区顺序仍按列定义(产品编码/产品规格/订单数量/客户)
  const i = draft.findIndex((c) => c.prop === '客户')
  const [moved] = draft.splice(i, 1)
  draft.push(moved)
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.deepEqual(propsOf(out).slice(0, 4), WO_BOARD_FROZEN_PROPS)
  assert.deepEqual(out.filter((c) => c.fixed === 'left').map((c) => c.prop), WO_BOARD_FROZEN_PROPS)
  // 冻结列只在冻结区出现一次(不会因为草稿里位置靠后而重复)
  assert.equal(propsOf(out).filter((p) => p === '客户').length, 1)
})

test('默认草稿:非冻结列按列定义顺序,日期组落在「大于15天已排」之后、「未交量」之前', () => {
  const out = boardRenderColumns(defaultDraft(), WO_BOARD_COLUMNS, DATES)
  const seq = propsOf(out)
  const nonFrozen = seq.filter((p) => !WO_BOARD_FROZEN_PROPS.includes(p))
  const expected = WO_BOARD_COLUMNS.filter((c) => !c.frozen && !c.anchor).map((c) => c.prop)
  assert.deepEqual(nonFrozen, expected)
  const beforeDate = seq[seq.indexOf('大于15天已排')]
  assert.equal(beforeDate, '大于15天已排')
  assert.ok(seq.indexOf('大于15天已排') < seq.indexOf('未交量'))
  // 日期列整组紧挨着「大于15天已排」之后
  const idxFirstDate = out.findIndex((c) => c.date)
  assert.equal(out[idxFirstDate - 1].prop, '大于15天已排')
  assert.deepEqual(datesOf(out), DATES)
})

test('隐藏的列不出;隐藏日期伪列 ⇒ 整组日期列隐藏', () => {
  const draft = defaultDraft()
  draft.find((c) => c.prop === '备注').visible = false
  draft.find((c) => c.prop === DAY_PLAN_COL_PROP).visible = false
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.ok(!propsOf(out).includes('备注'))
  assert.deepEqual(datesOf(out), [])
  // 隐藏日期组不影响其它列(锚点前后的列都还在,只是日期列没了)
  assert.ok(propsOf(out).includes('大于15天已排'))
  assert.ok(propsOf(out).includes('未交量'))
})

test('拖动日期伪列 = 整组日期列搬家(可挪到表首)', () => {
  const draft = defaultDraft()
  const i = draft.findIndex((c) => c.prop === DAY_PLAN_COL_PROP)
  const [anchor] = draft.splice(i, 1)
  draft.splice(WO_BOARD_FROZEN_PROPS.length, 0, anchor)   // 插到滚动区最前面
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  const seq = propsOf(out)
  // 冻结区仍在前,日期列紧跟冻结区之后
  const idxFirstDate = out.findIndex((c) => c.date)
  assert.equal(out[idxFirstDate - 1].prop, WO_BOARD_FROZEN_PROPS.at(-1))
  assert.equal(seq[WO_BOARD_FROZEN_PROPS.length], '工单行号')
})

test('草稿为空(首帧/没拉到设置)⇒ 全部列默认可见 + 默认顺序 + 日期组在锚点', () => {
  const out = boardRenderColumns([], WO_BOARD_COLUMNS, DATES)
  assert.deepEqual(propsOf(out), WO_BOARD_COLUMNS.filter((c) => !c.anchor).map((c) => c.prop))
  assert.deepEqual(datesOf(out), DATES)
  // 日期整组紧邻「未交量」之前(连续 N 个日期列,最后一个的下一列就是「未交量」)
  const idxLastDate = out.map((c) => !!c.date).lastIndexOf(true)
  assert.equal(out[idxLastDate + 1].prop, '未交量')
})

test('草稿里没有的新列默认可见;草稿里的死列名(已下架列)被丢弃', () => {
  const draft = defaultDraft().filter((c) => c.prop !== '打印次数')
  draft.push({ prop: '早就没了的列', visible: true })
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.ok(propsOf(out).includes('打印次数'))
  assert.ok(!propsOf(out).includes('早就没了的列'))
})

test('滚动列的拖动/▲▼ 目标下标被夹回滚动区(拖不进冻结区,弹窗顺序=表格顺序)', () => {
  const draft = defaultDraft()
  // 冻结区在草稿前 4 位 ⇒ 目标下标 0 / 2 / 负数 都要被夹到 4
  assert.equal(clampToScrollZone(draft, 0), WO_BOARD_FROZEN_PROPS.length)
  assert.equal(clampToScrollZone(draft, 2), WO_BOARD_FROZEN_PROPS.length)
  assert.equal(clampToScrollZone(draft, -5), WO_BOARD_FROZEN_PROPS.length)
  // 滚动区内部正常放了 = 原样返回;越界(尾部)夹到最后一个下标
  assert.equal(clampToScrollZone(draft, 6), 6)
  assert.equal(clampToScrollZone(draft, 999), draft.length - 1)
  // 冻结列自己拖动 = 在调用方被拦掉(这里只保证不会把别的列塞进冻结区)
  assert.ok(clampToScrollZone(draft, 1) >= WO_BOARD_FROZEN_PROPS.length)
})

test('冻结区列一旦被拖乱,渲染列序仍以列定义为准(不让冻结区散架)', () => {
  const draft = defaultDraft()
  // 模拟脏存档:把「产品编码」放到最后一位、把「未交量」塞到第 2 位
  const pc = draft.splice(draft.findIndex((c) => c.prop === '产品编码'), 1)[0]
  draft.push(pc)
  const dp = draft.splice(draft.findIndex((c) => c.prop === '未交量'), 1)[0]
  draft.splice(1, 0, dp)
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.deepEqual(propsOf(out).slice(0, 4), WO_BOARD_FROZEN_PROPS)
  // 被塞到第 2 位的「未交量」在表格里仍排在冻结区之后
  assert.ok(propsOf(out).indexOf('未交量') >= WO_BOARD_FROZEN_PROPS.length)
})

test('列名与数据键不同的列必须带 key(el-table 取值/排序靠它)', () => {
  const expectKey = {
    产品编码: '物料编码',
    产品规格: '规格型号',
    订单数量: '需求数量',
    可加工量: '当前工序可加工量',
    待报量: '当前工序待报量',
    待流入量: '当前工序待流入量',
  }
  for (const [prop, key] of Object.entries(expectKey)) {
    const col = WO_BOARD_COLUMNS.find((c) => c.prop === prop)
    assert.ok(col, `列定义里应有「${prop}」`)
    assert.equal(col.key, key, `「${prop}」的数据键应为「${key}」`)
  }
  // 其余列 prop 即数据键(不能凭空写 key,否则取不到值)
  const nonPlain = WO_BOARD_COLUMNS.filter((c) => c.key && !Object.keys(expectKey).includes(c.prop))
  assert.deepEqual(nonPlain, [])
})

// ── 2026-11-18 列设置「固定列位置」:固定后不随横向滚动移动 ─────────────────────────
test('固定左侧的滚动列排到冻结区之后、且带 fixed:left', () => {
  const draft = defaultDraft()
  draft.find((c) => c.prop === '备注').pin = 'left'
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  const seq = propsOf(out)
  // 冻结区 4 列仍在最前,紧接着就是被固定的「备注」
  assert.deepEqual(seq.slice(0, 4), WO_BOARD_FROZEN_PROPS)
  assert.equal(seq[4], '备注')
  assert.equal(out.find((c) => c.prop === '备注').fixed, 'left')
})

test('固定右侧的滚动列排在最后、且带 fixed:right(日期组不受影响)', () => {
  const draft = defaultDraft()
  draft.find((c) => c.prop === '操作员').pin = 'right'
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.equal(out.at(-1).prop, '操作员')
  assert.equal(out.at(-1).fixed, 'right')
  // 其余列的顺序/日期组位置不变
  assert.deepEqual(datesOf(out), DATES)
})

test('pin 为默认值/空串 ⇒ 不固定(definition 里的 frozen 例外:冻结区仍固定左)', () => {
  const draft = defaultDraft()
  draft.find((c) => c.prop === '备注').pin = ''
  const out = boardRenderColumns(draft, WO_BOARD_COLUMNS, DATES)
  assert.equal(out.find((c) => c.prop === '备注').fixed, undefined)
  assert.deepEqual(out.filter((c) => c.fixed === 'left').map((c) => c.prop), WO_BOARD_FROZEN_PROPS)
  // 默认固定表 = 冻结区四列
  assert.deepEqual(Object.keys(WO_BOARD_DEFAULT_PINS), WO_BOARD_FROZEN_PROPS)
})
