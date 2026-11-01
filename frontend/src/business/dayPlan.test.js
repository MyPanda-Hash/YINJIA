import test from 'node:test'
import assert from 'node:assert/strict'
import { qtyText, isPast, isToday, dayColState, isOverCapacity, dayCellQty, isOutOfPlanRange } from './dayPlan.js'

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

test('dayCellQty:一格一个数 —— 有报工显示实际,没报工显示计划', () => {
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
