/**
 * 日排产(2026-10-29)纯逻辑 —— 只放**显示层**判定;日计划本身由后端算(见下)。
 *
 * 生产工单(WorkOrderList)与工单排产(WorkOrderBoard)两页共用:
 *   · 表格里的「日期列」:格上方是当天计划量、格下方绿色小字是当天已审核报工量;
 *   · 计划量**由后端自动算**(`DayPlanSpread`:工序计划量 ÷ 开工日→交期),前端不填、不保存。
 *
 * ⚠ 2026-10-31 用户口径(逐轮收敛的最终态,别往回改):
 *   1. 「**当前不需要手填,能自动算就可以了**」⇒ 日期格**只读**,「保存日排产」按钮与
 *      手填/落库链路整体撤除(2026-10-30 删掉的「按完工日期均摊」弹窗也不需要恢复);
 *      日计划是派生值:交期/排产数量一改,下次刷新自然就变。
 *   2. 产能**只显示、不拦截** —— 不影响实际排产量;超产能只把列头标红;
 *      开工日/完工日/交期只做查询与显示(不排序、不卡窗口)。
 *   3. 格内两个数要分清:上=计划,下=报工(「实」标 + 绿色);日期列分段:
 *      今天列标「今」+ 浅蓝底、过去列灰底(历史对照段)。
 *
 * 本文件只放这些**纯判定**(便于单测),接口调用见 `business/dayPlanApi.js`,组件只管状态与渲染。
 */

/** 数量显示:0/空显示空白(日期格没排就是空的,免得满屏 0) */
export function qtyText(v) {
  const n = Number(v || 0)
  return n ? n.toFixed(2).replace(/\.?0+$/, '') : ''
}

/** 日期是否属于"过去"(不含今天):过去列 = 历史对照段(列头/格子灰底) */
export function isPast(date, today) {
  return !!date && !!today && date < today
}

/** 日期是否就是"今天"(列头标「今」,一眼看出哪一列是当天) */
export function isToday(date, today) {
  return !!date && !!today && date === today
}

/**
 * 日期列状态(2026-10-31 用户口径「列头标出今/过去,别让两段混在一起」):
 * `past` = 今天以前的列(历史对照)、`today` = 今天列(标「今」)、`future` = 今天以后。
 *
 * <p>只影响列头与底色,不改任何取数口径。
 */
export function dayColState(date, today) {
  if (!date || !today) return 'future'
  if (isToday(date, today)) return 'today'
  return isPast(date, today) ? 'past' : 'future'
}

/**
 * 超产能判定(2026-10-31):某线某天「已排 > 日产能」⇒ true(界面标红)。
 *
 * <p>产能 <= 0 视为**未配产能**,一律不判超载 —— 沿用 bs_prod_line.日产能 列注明「0=不判超载」。
 * 本函数只用于显示,调用方**不得**据此拦任何东西(用户口径:不堵死录入)。
 *
 * @param {number} planned  该线当天已排合计
 * @param {number} capacity 产线日产能
 */
export function isOverCapacity(planned, capacity) {
  const cap = Number(capacity || 0)
  return cap > 0 && Number(planned || 0) > cap + 1e-6
}

/**
 * 日计划格的**融合显示**(2026-10-31 用户口径:「计划和实际排产这个得融合的好一点,当前太丑了…
 * 如果没达成当前的计划产量日期的量再填入实际的数量,没有实际报工的话就还是显示原来的数量」)。
 *
 * <p>一个格子只显示**一个数**:
 * <ul>
 *   <li>当天没有已审报工 ⇒ 显示**计划**(原来那样);</li>
 *   <li>报了但**没达成**计划 ⇒ 显示**实际**(一眼看出差多少);</li>
 *   <li>已达成的 ⇒ 仍显示**计划**(达成时两者没差,不必再标)。</li>
 * </ul>
 * 计划为 0 却有报工(临时插单/补做)⇒ 显示实际。
 *
 * @param {number} plan   当日计划(人工指定 ∪ 自动摊剩余后的值)
 * @param {number} actual 当日已审核报工量
 * @returns {{qty:number, isActual:boolean}} qty=要显示的数; isActual=显示的是不是实际值(前端标色)
 */
export function dayCellQty(plan, actual) {
  const p = Number(plan || 0)
  const a = Number(actual || 0)
  if (a <= 0) return { qty: p, isActual: false }
  if (p <= 0 || a < p) return { qty: a, isActual: true }
  return { qty: p, isActual: false }
}
