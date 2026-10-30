/**
 * 日排产接口封装(2026-10-29):生产工单 / 工单排产 两页共用。
 *
 * 读:`/px/scheduleBoard/dayPlan/data` —— 窗口内每行的日计划(wo_day_plan)与日报工(scjl 已审核);
 * 写:`/px/scheduleBoard/dayPlan/save` —— 0/空 = 软删该格。
 */
import request from '@core/request'

/** 取窗口数据:{ 日期, 今天, 行: [{行id, 工序, 日计划, 日报工, 计划合计, 完工合计}] } */
export async function fetchDayPlan(params) {
  const res = await request.post('/px/scheduleBoard/dayPlan/data', params)
  return res.data || {}
}

/** 保存日计划格子:rows = [{ 工单行id, 工序, 生产线, 计划日期, 计划数量 }] */
export async function saveDayPlan(rows) {
  const res = await request.post('/px/scheduleBoard/dayPlan/save', { rows })
  return res.data || {}
}
