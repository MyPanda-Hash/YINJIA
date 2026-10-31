/**
 * 日排产接口封装(2026-10-29):生产工单 / 工单排产 两页共用。
 *
 * 读:`/px/scheduleBoard/dayPlan/data` —— 窗口内每行的**自动日计划**(由后端按
 * 「工序计划量 ÷ 开工日→交期」均摊算出,不落表)与日报工(scjl 已审核)。
 *
 * ⚠ 2026-10-31 用户口径「当前不需要手填,能自动算就可以了」⇒ 前端的 `saveDayPlan` 已删除,
 *   页面不再写 `wo_day_plan`(后端 `/dayPlan/save` 端点仍在,仅为兼容/回滚保留)。
 */
import request from '@core/request'

/** 取窗口数据:{ 日期, 今天, 行: [{行id, 工序, 日计划, 日报工, 计划合计, 完工合计}] } */
export async function fetchDayPlan(params) {
  const res = await request.post('/px/scheduleBoard/dayPlan/data', params)
  return res.data || {}
}
