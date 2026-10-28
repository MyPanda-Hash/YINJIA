/**
 * 研发「项目流程管控」接口封装。
 *
 * 对应后端 PxController:GET /px/rdFlow?keyword=…
 *   入参 keyword = 立项申请单号(或其文档编号/机型)片段;空 = 全部在册立项。
 *   出参 data = { projects:[…事实…], truncated, names:{账号:姓名} }
 * 环节判定不在这里做 —— 交给纯函数 @/core/rd/flowStages(单测钉边界)。
 * 前缀 /api 由 @core/request 的 baseURL 处理。
 */
import request from '@core/request'

function unwrap(res, fallback) {
  if (res && res.code && res.code !== 200) throw new Error(res.message || fallback)
  return res?.data ?? res
}

/** 按立项单号(片段)取流程事实;不传 keyword = 全部在册立项 */
export async function apiQueryRdFlow(keyword) {
  return unwrap(
    await request.get('/px/rdFlow', { params: keyword ? { keyword } : {} }),
    '加载项目流程失败',
  )
}
