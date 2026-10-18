import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REPORT_QUERY_DIALOG_PANELS,
  cleanCondition,
  defaultReportRange,
  reportQueryDialogOn,
  shouldAutoOpenReportQuery,
  validateReportQuery,
} from './reportQuery.js'

/* ═══════════════════════════════════════════════════════════════════════════
 * 用户报障(2026-10-20):「库存台账和收发存汇总表出现重复弹窗和查询问题」
 * 根因:弹窗门只按「查过没有(rqdDone)」判,不按「弹窗是否已开着」判 —— 一次进入面板后,
 *       后台任何一次 load()(切面板双触发 / 刷新 / 导入后…)都会把弹窗再开一遍;
 *       「重复查询」同理。下面几条把判据钉死在纯函数上,组件里不许再出现第二处 if。
 * ═══════════════════════════════════════════════════════════════════════════ */

test('只有台账/汇总走弹窗门;其它面板即便元数据标了也不弹', () => {
  assert.deepEqual(REPORT_QUERY_DIALOG_PANELS, ['STOCK_LEDGER', 'STOCK_SUMMARY'])
  assert.equal(reportQueryDialogOn('STOCK_LEDGER', true), true)
  assert.equal(reportQueryDialogOn('STOCK_SUMMARY', true), true)
  // 服务端没下发标记(或下发了非 true)⇒ 不开门
  assert.equal(reportQueryDialogOn('STOCK_LEDGER', undefined), false)
  assert.equal(reportQueryDialogOn('STOCK_LEDGER', 'true'), false)
})

test('首次进入弹一次;弹窗开着时再调 load 不能再弹(重复弹窗的直接防线)', () => {
  const base = { enabled: true, panelCode: 'STOCK_LEDGER', hasApplied: false, dialogVisible: false }
  assert.equal(shouldAutoOpenReportQuery(base), true, '首次进入应当弹')
  // 关键:弹窗已经开着 —— 后台再来多少次 load 都不许再开第二次
  assert.equal(shouldAutoOpenReportQuery({ ...base, dialogVisible: true }), false)
})

test('每个面板每次进入只自动弹一次:关掉之后并发 load 不能把弹窗顶回来(竞态防线)', () => {
  // 复现 2026-10-20 实机竞态的判定序列:✕ 关闭 ⇒ router.push 还没落地 ⇒ 又来一次 load
  const st = { enabled: true, panelCode: 'STOCK_LEDGER', hasApplied: false, dialogVisible: false, alreadyAutoOpened: false }
  assert.equal(shouldAutoOpenReportQuery(st), true, '① 进入:弹')
  // 用户点 ✕:弹窗关掉,但 hasApplied 仍是 false、panelCode 仍是旧值
  const afterClose = { ...st, dialogVisible: false, alreadyAutoOpened: true }
  assert.equal(shouldAutoOpenReportQuery(afterClose), false, '② 关掉后那次晚到的 load 不许再弹(否则就是"关了又弹")')
  // 连来三次也一样
  assert.equal(shouldAutoOpenReportQuery({ ...afterClose }), false)
  assert.equal(shouldAutoOpenReportQuery({ ...afterClose }), false)
  // 重新进入本面板(panelCode 变化 ⇒ 重置 alreadyAutoOpened)⇒ 再弹一次
  assert.equal(shouldAutoOpenReportQuery({ ...afterClose, alreadyAutoOpened: false }), true, '③ 重新进入可以再弹')
})

test('已经成功查询过一次(票已记)后,任何 load 都不再弹', () => {
  const base = { enabled: true, panelCode: 'STOCK_SUMMARY', hasApplied: true, dialogVisible: false }
  assert.equal(shouldAutoOpenReportQuery(base), false)
  assert.equal(shouldAutoOpenReportQuery({ ...base, dialogVisible: true }), false)
})

test('离开面板(panelCode 空/undefined)或非弹窗面板一律不弹', () => {
  assert.equal(shouldAutoOpenReportQuery({ enabled: true, panelCode: '', hasApplied: false, dialogVisible: false }), false)
  assert.equal(shouldAutoOpenReportQuery({ enabled: true, panelCode: 'undefined', hasApplied: false, dialogVisible: false }), false)
  assert.equal(shouldAutoOpenReportQuery({ enabled: false, panelCode: 'STOCK_BALANCE', hasApplied: false, dialogVisible: false }), false)
  // 参数缺省也不炸
  assert.equal(shouldAutoOpenReportQuery(), false)
})

test('必填校验:日期段必填;台账另需一个仓库 + 一种存货,汇总只要日期', () => {
  assert.deepEqual(validateReportQuery({ panelCode: 'STOCK_SUMMARY', range: [] }), { ok: false, reason: 'range' })
  assert.deepEqual(validateReportQuery({ panelCode: 'STOCK_SUMMARY', range: ['2026-10-01'] }), { ok: false, reason: 'range' })
  assert.deepEqual(validateReportQuery({ panelCode: 'STOCK_SUMMARY', range: ['2026-10-01', '2026-10-20'] }), { ok: true })
  // 台账:缺仓库或缺存货都不行
  assert.deepEqual(
    validateReportQuery({ panelCode: 'STOCK_LEDGER', range: ['2026-10-01', '2026-10-20'], wh: '', item: '端盖' }),
    { ok: false, reason: 'whItem' })
  assert.deepEqual(
    validateReportQuery({ panelCode: 'STOCK_LEDGER', range: ['2026-10-01', '2026-10-20'], wh: '正品仓', item: '' }),
    { ok: false, reason: 'whItem' })
  assert.deepEqual(
    validateReportQuery({ panelCode: 'STOCK_LEDGER', range: ['2026-10-01', '2026-10-20'], wh: '正品仓', item: '端盖' }),
    { ok: true })
})

test('默认区间 = 本月初 → 今天(本地时区)', () => {
  assert.deepEqual(defaultReportRange(new Date(2026, 9, 20)), ['2026-10-01', '2026-10-20'])
  assert.deepEqual(defaultReportRange(new Date(2026, 0, 5)), ['2026-01-01', '2026-01-05'])
  assert.deepEqual(defaultReportRange(new Date(2026, 11, 31)), ['2026-12-01', '2026-12-31'])
})

test('condition 整理:只去空值;`_` 控制键必须原样保留(台账按编码过滤全靠它)', () => {
  // ⚠ 2026-10-20 实机教训:一度把 `_` 开头的键也丢掉 ⇒ 台账查询退化成「只剩期初+期末两行」
  //   (后端没有 _whCode/_itemCode 就只能按名称 LIKE,或干脆只剩合成行)。这条断言是护栏。
  assert.deepEqual(
    cleanCondition({ 仓库: '正品仓', 存货: '', 开始日期: '2026-10-01', 结束日期: '2026-10-20', _whCode: 'CK00001', 空: undefined, 无: null }),
    { 仓库: '正品仓', 开始日期: '2026-10-01', 结束日期: '2026-10-20', _whCode: 'CK00001' })
  assert.deepEqual(cleanCondition(), {})
})
