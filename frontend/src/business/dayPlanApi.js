/**
 * 日排产接口封装(2026-10-29):生产工单 / 工单排产 两页共用。
 *
 * 读:`/px/scheduleBoard/dayPlan/data` —— 窗口内每行的日计划(「人工指定 ∪ 自动摊剩余」)、
 *     日报工(scjl 已审核)、人工指定集合、超分配,以及产能列头用的「每日已排」。
 * 写:`/px/scheduleBoard/dayPlan/save` —— **数量>0 = 人工指定该天;0/空 = 软删 = 恢复自动**。
 * 写:`/px/scheduleBoard/rowDates` —— 改「计划开工日 / 预定完成日」(同步 plang_pc 与工序台账区间)。
 *
 * ⚠ 2026-10-31 语义变更:日计划不再"全量手填",系统按「工序计划量 ÷ 开工日→交期」自动均摊;
 *   人工只改**某一天**,其余天按剩余量重摊(守恒,用户口径「剩余量重摊,总数守恒」)。
 */
import request from '@core/request'

/** 取窗口数据:{ 日期, 今天, 行: [{行id, 工序, 日计划, 日报工, 人工指定, 超分配, 计划合计, 完工合计}] } */
export async function fetchDayPlan(params) {
  const res = await request.post('/px/scheduleBoard/dayPlan/data', params)
  return res.data || {}
}

/**
 * 保存人工指定的一格(2026-10-31):rows = [{ 工单行id, 工序, 生产线, 计划日期, 计划数量 }]
 * 数量 > 0 = 指定该天;0/空 = 软删该格 = **恢复自动**。返回 { 保存格数, 清空格数, 超分配[] }。
 */
export async function saveDayPlan(rows) {
  const res = await request.post('/px/scheduleBoard/dayPlan/save', { rows })
  return res.data || {}
}

/**
 * 改排产日期(2026-10-31):params = { 行id, 计划开工日期?, 交期? }(只传改动的那一个)。
 * 后端写 plang(真源)+ 镜像 plang_pc + 同步 wo_process_line 各道工序的计划区间。
 */
export async function saveRowDates(params) {
  const res = await request.post('/px/scheduleBoard/rowDates', params)
  return res.data || {}
}
