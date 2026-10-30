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
 * 只放可单测的纯函数(接口调用见 business/dayPlanApi.js),组件只管状态与渲染,
 * 保证两页行为完全一致。
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
