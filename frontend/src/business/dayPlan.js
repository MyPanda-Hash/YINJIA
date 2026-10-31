/**
 * 日排产(2026-10-29)纯逻辑。
 *
 * 生产工单(WorkOrderList)与工单排产(WorkOrderBoard)两页共用:
 *   · 表格里的「日期列」:格上方是可编辑的计划量(人工逐格填),格下方小字是当天已审核报工量;
 *   · 「保存日排产」把改动过的格子写进 wo_day_plan。
 *
 * ⚠ 2026-10-30 用户口径「把当前这个按日期均摊的功能删除,没啥用」:
 *   原 buildSplit(按 起点~完工日 均摊剩余数量)+ DayPlanSplitDialog 已删除;
 *   日计划现在**只能**由排产员逐格手工填 —— 不要为了"省事"再把自动均摊加回来。
 *
 * ⚠ 2026-10-31 用户口径(产能这块的最终结论):
 *   · 产能**只显示、不拦截** —— 排产数量该填多少还是多少,产能不影响实际排产量;
 *   · 生产工单的**开工日/完工日/交期只做查询与显示**,不驱动排产(不排序、不均摊、不卡窗口);
 *   · 超产能只把界面标红(不弹窗、不改数、不禁填);
 *   · 「分配」由排产员手工做,系统只提示「还差多少没分配」(允许只排一部分,不逼一次排完)。
 *   本文件只放这两件事的纯判定,接口调用见 business/dayPlanApi.js,组件只管状态与渲染。
 *
 * ⚠ 2026-10-31 下午(用户报障「格子里两个数堆在一起,不知道哪个是报工」):
 *   日期列的分段与标识也只在这里判定 —— `dayColState` 决定列头「今」/过去列灰底,
 *   格内则固定「上=计划(可编辑)、下=报工(加「实」标)」。均为显示层,不改任何取数口径
 *   (过去日期照旧可填计划,见 2026-10-29 口径「23~28 号填不了」)。
 */

/** 对比「原计划 / 当前计划」,返回改动过的格子(含清空:数量 0) */
export function diffPlan(original, current, dates) {
  const out = []
  for (const d of dates || []) {
    const a = Number((original || {})[d] || 0)
    const b = Number((current || {})[d] || 0)
    if (a !== b) out.push({ 日期: d, 数量: b })
  }
  return out
}

/** 数量显示:0/空显示空白(日期格没排就是空的,免得满屏 0) */
export function qtyText(v) {
  const n = Number(v || 0)
  return n ? n.toFixed(2).replace(/\.?0+$/, '') : ''
}

/** 日期是否属于"过去"(不含今天):过去格只读显示完成量 */
export function isPast(date, today) {
  return !!date && !!today && date < today
}

/** 日期是否就是"今天"(列头标「今」,一眼看出哪一列是当天) */
export function isToday(date, today) {
  return !!date && !!today && date === today
}

/**
 * 日期列状态(2026-10-31 用户口径「列头标出今/过去,别让两段混在一起」):
 * `past` = 今天以前的列(只做历史对照,列头/格子灰底)、`today` = 今天列(标「今」)、
 * `future` = 今天以后的列(照常排产)。
 *
 * <p>当天色板只影响显示,不改任何取数口径 —— 过去列同样可编辑(用户口径「23~28 号填不了」要能填)。
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
 * 本函数只用于显示,调用方**不得**据此拦保存(用户口径:不堵死录入)。
 *
 * @param {number} planned  该线当天已排合计
 * @param {number} capacity 该线日产能
 */
export function isOverCapacity(planned, capacity) {
  const cap = Number(capacity || 0)
  return cap > 0 && Number(planned || 0) > cap + 1e-6
}

/**
 * 未分配量 = 工序计划量 − Σ日计划(2026-10-31 用户口径「允许只排一部分,但把还差多少摆出来」)。
 *
 * <p>工序计划量取不到(<= 0)时返回 null,界面显示 "-" —— 不要算成负数把老数据吓红。
 *
 * @param {number} opCap        工序计划量(排产数量 × 该道换算率,后端算)
 * @param {number} plannedTotal 该行当前 Σ日计划(所有日期)
 * @returns {number|null}
 */
export function unplannedQty(opCap, plannedTotal) {
  const cap = Number(opCap || 0)
  if (cap <= 0) return null
  return Math.round((cap - Number(plannedTotal || 0)) * 10000) / 10000
}
