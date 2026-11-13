import test from 'node:test'
import assert from 'node:assert/strict'
import {
  qtyText, isPast, isToday, dayColState, isOverCapacity, dayCellQty, isOutOfPlanRange,
  dayCellView, historyShortfalls, shortfallTotals,
} from './dayPlan.js'

// ⚠ 2026-10-31 用户口径「当前不需要手填,能自动算就可以了」:
//   日计划改由后端自动均摊(DayPlanSpread),前端的 buildSplit / diffPlan / unplannedQty
//   与「保存日排产」链路一并删除 —— 这里只留仍在用的显示层纯函数。
//   均摊规则本身的回归闸在后端:tools/archive/_dayplan-auto-20261031/SpreadTest.java。

test('qtyText:0 显示空白', () => {
  assert.equal(qtyText(0), '')
  assert.equal(qtyText(null), '')
  assert.equal(qtyText(1500), '1500')
  assert.equal(qtyText(1500.5), '1500.5')
})

test('isPast:今天不算过去', () => {
  assert.equal(isPast('2026-10-28', '2026-10-29'), true)
  assert.equal(isPast('2026-10-29', '2026-10-29'), false)
})

test('isToday:只有当天为真', () => {
  assert.equal(isToday('2026-10-31', '2026-10-31'), true)
  assert.equal(isToday('2026-10-30', '2026-10-31'), false)
  assert.equal(isToday('2026-11-01', '2026-10-31'), false)
  assert.equal(isToday('', '2026-10-31'), false)
})

test('dayColState:过去/今天/未来三段(只影响列头与底色,不改取数)', () => {
  const today = '2026-10-31'
  assert.equal(dayColState('2026-10-20', today), 'past')
  assert.equal(dayColState('2026-10-31', today), 'today')
  assert.equal(dayColState('2026-11-01', today), 'future')
  assert.equal(dayColState('2026-10-31', ''), 'future')   // 没拿到今天:不标「今」也不灰底
  assert.equal(dayColState('', today), 'future')
})

test('isOverCapacity:超产能只用于显示;未配产能(<=0)不判', () => {
  assert.equal(isOverCapacity(12000, 11000), true)
  assert.equal(isOverCapacity(11000, 11000), false) // 刚好排满不算超
  assert.equal(isOverCapacity(0, 11000), false)
  assert.equal(isOverCapacity(12000, 0), false)     // 未配产能 = 不判超载
  assert.equal(isOverCapacity(12000, null), false)
})

test('dayCellQty:一格一个数 —— 有报工显示实际,没报工显示计划(旧口径,保留给降级路径)', () => {
  // 没报工 ⇒ 显示计划
  assert.deepEqual(dayCellQty(2, 0), { qty: 2, isActual: false })
  // 报了(不论达成与否)⇒ 显示实际(标色,2026-10-31 用户口径「完成数量不能没有」)
  assert.deepEqual(dayCellQty(5, 3), { qty: 3, isActual: true })
  assert.deepEqual(dayCellQty(5, 5), { qty: 5, isActual: true })
  assert.deepEqual(dayCellQty(5, 8), { qty: 8, isActual: true })
  // 计划 0 但有报工(补做)⇒ 显示实际
  assert.deepEqual(dayCellQty(0, 3), { qty: 3, isActual: true })
  // 空值安全
  assert.deepEqual(dayCellQty(null, null), { qty: 0, isActual: false })
})

// ⚠ 2026-11-01 用户口径「如果改行的日期不再整个的排产中就要有斜杆在这个日期表下,
//   就比如我修改最下面一条的开工日期为 11.02 号了,那么今日的那行就要画/」。
test('isOutOfPlanRange:区间 = 开工日 → 计划完工日,区间外画斜杠', () => {
  // 用户例子:开工日改成 11-02 后,11-01 那格要画 /
  assert.equal(isOutOfPlanRange('2026-11-01', '2026-11-02', '2026-11-06'), true)
  // 区间内不画
  assert.equal(isOutOfPlanRange('2026-11-02', '2026-11-02', '2026-11-06'), false)
  assert.equal(isOutOfPlanRange('2026-11-04', '2026-11-02', '2026-11-06'), false)
  // 完工日之后也画
  assert.equal(isOutOfPlanRange('2026-11-07', '2026-11-02', '2026-11-06'), true)
  // 某一端为空:那一端不画(历史单常态),另一端照画
  assert.equal(isOutOfPlanRange('2026-10-20', '', '2026-11-06'), false)
  assert.equal(isOutOfPlanRange('2026-11-07', '', '2026-11-06'), true)
  assert.equal(isOutOfPlanRange('2026-10-20', '2026-11-02', ''), true)
  assert.equal(isOutOfPlanRange('2026-11-20', '2026-11-02', ''), false)
  // 两端都空(未定区间)= 不画;空日期 = 不画
  assert.equal(isOutOfPlanRange('2026-11-01', '', ''), false)
  assert.equal(isOutOfPlanRange('', '2026-11-02', '2026-11-06'), false)
  // 后端可能带时间部分:只比日期
  assert.equal(isOutOfPlanRange('2026-11-01', '2026-11-02T00:00:00', '2026-11-06T00:00:00'), true)
  // 老数据哨兵 1900-01-01 = "没填" ⇒ 该端不画杠(实测正式库 cp_date 有 8 行是哨兵,
  //   不当空处理会把整行日期全画成斜杠)
  assert.equal(isOutOfPlanRange('2026-11-01', '1900-01-01T00:00:00', '2026-11-06T00:00:00'), false)
  assert.equal(isOutOfPlanRange('2026-11-07', '1900-01-01', '2026-11-06'), true)
  assert.equal(isOutOfPlanRange('2026-11-20', '2026-11-02', '1900-01-01'), false)
  // 完工日早于开工日(录入反了,实测 GD-2026-10-0202:10-11 → 10-10):收成单日窗口,不整行画杠
  assert.equal(isOutOfPlanRange('2026-10-11', '2026-10-11', '2026-10-10'), false)
  assert.equal(isOutOfPlanRange('2026-10-12', '2026-10-11', '2026-10-10'), true)
})

// ⚠ 2026-11-13 用户口径(附截图):「在这里增加一个原计划量/报工数,当天结束后未完成会进行提示」
//   「报工后显示在当前位置和原计划量/实际报工量」⇒ 格内两数「原计划/报工」,过去日期不足标红。
test('dayCellView:有报工 ⇒ 原计划/报工;今天结束前不判欠产', () => {
  const v = dayCellView(700, 15, 715, false)   // 今天:日计划已扣掉 15,原计划仍是 715
  assert.equal(v.text, '715/15')
  assert.equal(v.planText, '715')
  assert.equal(v.actualText, '15')
  assert.equal(v.hasActual, true)
  assert.equal(v.short, 0)                     // 当天还没结束 ⇒ 不提示未完成
})

test('dayCellView:过去日期 报工<原计划 ⇒ 欠产(short),达成/超产 ⇒ 不欠', () => {
  const short = dayCellView(0, 15, 715, true)  // 历史日期没有重摊计划,只剩原计划对照
  assert.equal(short.text, '715/15')
  assert.equal(short.short, 700)
  const done = dayCellView(0, 715, 715, true)
  assert.equal(done.text, '715/715')
  assert.equal(done.short, 0)
  const over = dayCellView(0, 800, 715, true)  // 超产:不算欠
  assert.equal(over.short, 0)
})

test('dayCellView:过去日期一笔没报 ⇒ 原计划/0(整格欠产)', () => {
  const v = dayCellView(0, 0, 700, true)
  assert.equal(v.text, '700/0')
  assert.equal(v.hasActual, false)
  assert.equal(v.short, 700)
})

test('dayCellView:没报工 ⇒ 仍显示计划(今天及以后,原样)', () => {
  const v = dayCellView(685, 0, 715, false)
  assert.equal(v.text, '685')                  // 没报工时格内还是"今天起还要做多少"
  assert.equal(v.short, 0)
  assert.equal(v.hasActual, false)
})

test('dayCellView:后端没返回 原计划(旧 8090)⇒ 退回单数显示,不造数', () => {
  // 有报工、无基线 ⇒ 只显示报工(2026-11-13 实测口径:不拿"今天起还要做多少"冒充原计划)
  const deg = dayCellView(685, 15, 0, false)
  assert.equal(deg.text, '15')
  assert.equal(deg.planText, '')
  assert.equal(deg.actualText, '15')
  assert.equal(deg.hasActual, true)
  assert.equal(deg.hasBaseline, false)
  assert.equal(dayCellView(0, 15, 0, true).text, '15')
  assert.equal(dayCellView(0, 15, 0, true).short, 0)   // 没有基线就不判欠产
  // 没报工、无基线 ⇒ 计划
  assert.equal(dayCellView(2, 0, null, false).text, '2')
  assert.equal(dayCellView(0, 0, 0, true).text, '')
})

test('historyShortfalls:只数已结束日期;今天/未来/原计划0 都不算', () => {
  const rows = [
    {
      行id: 1,
      原计划: { '2026-11-10': 700, '2026-11-11': 700, '2026-11-12': 0, '2026-11-13': 715, '2026-11-14': 100 },
      日报工: { '2026-11-10': 15, '2026-11-11': 700, '2026-11-13': 15, '2026-11-14': 200 },
    },
    { 行id: 2, 原计划: { '2026-11-11': 300 }, 日报工: {} },
  ]
  const items = historyShortfalls(rows, '2026-11-13')
  assert.deepEqual(items.map((x) => [x.row.行id, x.date, x.plan, x.actual, x.short]), [
    [1, '2026-11-10', 700, 15, 685],
    [2, '2026-11-11', 300, 0, 300],
  ])
  assert.deepEqual(shortfallTotals(items), { count: 2, qty: 985 })
})

test('historyShortfalls:后端未升级(没有 原计划)/空行 ⇒ 空,顶部提示整行不出现', () => {
  assert.deepEqual(historyShortfalls([{ 行id: 1 }], '2026-11-13'), [])
  assert.deepEqual(historyShortfalls([], '2026-11-13'), [])
  assert.deepEqual(historyShortfalls([{ 原计划: { '2026-11-10': 5 } }], ''), [])   // 没拿到今天不判
  assert.deepEqual(shortfallTotals(null), { count: 0, qty: 0 })
})
