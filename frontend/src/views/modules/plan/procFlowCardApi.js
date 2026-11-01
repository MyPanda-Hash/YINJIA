/**
 * procFlowCardApi.js — 「工序流程追踪卡」的接口封装与显示 helper(2026-10-29)
 *
 * 【契约来源】docs/design/工序流程追踪卡-V1.0.md §3(全部 `POST /api/procCard/*`,
 *   统一 `ApiResult{code,message,data}`;JSON 键名是**中文数据键**,照抄不许改写)。
 *   ⚠ 键名是数据键(ADR-0001):不翻译、不转 camelCase —— 显示层用 tt() 翻的是**标签**,不是键。
 *
 * 【为什么单独一个文件】页面/卡面/照片墙/追溯抽屉四块都要发同一套请求,
 *   集中在这里才算「一次定义、四处引用」(代码规范 D1 三次法则);同时把
 *   「code≠200 抛错」「附件地址」「数字/时间格式」这些显示口径收成一处,
 *   避免四个组件各写一份。
 *
 * 【错误口径】axios 拦截器已把 HTTP 4xx/5xx 转成 reject(见 @core/request);
 *   这里再兜住「HTTP 200 但 body code≠200」的业务失败,统一 throw ——
 *   调用方一律 `catch (e) { ElMessage.error(errText(e, '查询失败')) }`,后端未就绪(404/500)
 *   时页面只会弹提示,不会白屏。
 */
import request from '@core/request'
import { canDo } from '@core/auth/panelAccess'
import { tt } from '@/i18n'

/** 页面级虚拟面板码(后端 PagePanelRegistry.PROC_FLOW_CARD;动作词 view/query/entry/confirm) */
export const PROC_FLOW_CARD = 'PROC_FLOW_CARD'

/** 照片上传的附件面板码(与后端 AttachmentService 的 panel_code 一致) */
export const ATTACH_PANEL = 'PROC_FLOW_CARD'

/** 单张照片大小上限(MB):全局 multipart 上限 20MB,前端先挡一道给出可读提示 */
export const PHOTO_MAX_MB = 20

/** 每道工序建议照片数上限(软提示,不拦上传 —— 契约 §2.3「建议 ≤20 张」) */
export const PHOTO_SOFT_MAX = 20

/** POST → ApiResult.data;body code≠200 时抛出带 message 的 Error */
async function post(url, body) {
  const res = await request.post(url, body || {})
  if (res && typeof res.code === 'number' && res.code !== 200) {
    const e = new Error(res.message || 'request failed')
    e.code = res.code
    throw e
  }
  return res == null ? null : res.data
}

/**
 * 契约 §3 的 8 个接口(键名与入参**照契约**;调用方只传业务字段,空值可省)。
 * - batches   大批次列表 [{批次号,行数,卡数,产品数,计划数量}]
 * - lines     某批次下工单行(小批次候选)
 * - create    为工单行建卡(幂等;data 同 detail)
 * - detail    卡详情(完成情况现算)
 * - save      保存卡(备注/卡状态)
 * - list      卡片列表(分页)
 * - batchTrace 批次追溯(汇总 + 卡片)
 * - trace     单卡追溯(卡 → 工序 → 报工 → 工单追溯)
 */
export const procCardApi = {
  meta: () => post('/procCard/meta', {}),
  batches: (cond) => post('/procCard/batches', cond),
  lines: (cond) => post('/procCard/lines', cond),
  create: (body) => post('/procCard/create', body),
  detail: (body) => post('/procCard/detail', body),
  save: (body) => post('/procCard/save', body),
  list: (body) => post('/procCard/list', body),
  batchTrace: (body) => post('/procCard/batchTrace', body),
  trace: (body) => post('/procCard/trace', body),
}

/** 工序照片的附件列位键:'工序照片-<工序序>'(契约 §2.3;序号取整,缺失按 0) */
export function photoField(seq) {
  return `工序照片-${Number(seq) || 0}`
}

/**
 * 上传一张工序照片(POST /attachment/upload,multipart)。
 * 返回服务端 {files,names};失败 throw(调用方提示)。
 */
export async function uploadPhoto({ cardNo, seq, file }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('panelCode', ATTACH_PANEL)
  fd.append('docNo', String(cardNo || ''))
  fd.append('field', photoField(seq))
  const res = await request.post('/attachment/upload', fd, { timeout: 120000 })
  if (res && typeof res.code === 'number' && res.code !== 200) {
    const e = new Error(res.message || 'upload failed')
    e.code = res.code
    throw e
  }
  return res == null ? null : res.data
}

/** 删除一张照片(POST /attachment/delete {id}) */
export function deletePhoto(id) {
  return post('/attachment/delete', { id })
}

/** 取附件字节(缩略图/预览共用;鉴权走 axios 拦截器的 Bearer token) */
export function loadAttachmentBlob(id) {
  return request.get(`/attachment/${id}/download`, { responseType: 'blob', timeout: 120000 })
}

/** 按扩展名猜图片 contentType:统一预览工具靠它判定「浏览器能否直开」 */
export function guessImageType(fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop()
  const map = { png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }
  return map[ext] || 'image/jpeg'
}

/** 数量显示:整数去掉小数尾巴(与 WorkOrderList.num / MobilePick.fmt 同一口径) */
export function fmtNum(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000)
}

/** 时间显示:去掉末尾毫秒/时区,空值给 '-' */
export function rmtTime(t) {
  if (!t) return '-'
  const s = String(t)
  return s.length > 10 ? s.slice(0, 19).replace('T', ' ') : s
}

/** 工序状态 → el-tag 类型(契约 §1.4:已完工/进行中/未开始) */
export function statusTagType(status) {
  if (status === '已完工') return 'success'
  if (status === '进行中') return 'warning'
  return 'info'
}

/** 卡状态 → el-tag 类型 */
export function cardStatusType(status) {
  return status === '已完成' ? 'success' : 'info'
}

/** 工序完成进度百分比(计划量 ≤0 时按 0,不出现除零/NaN) */
export function opPct(op) {
  const plan = Number(op?.计划数量 || 0)
  const done = Number(op?.已报工 || 0)
  if (!(plan > 0)) return 0
  return Math.min(100, Math.round((done / plan) * 100))
}

/**
 * 错误提示文案:后端 message 优先;HTTP 错误(后端未就绪的 404/500)带状态码,
 * 避免界面只剩一句英文 "Request failed with status code 404";
 * 其余按业务场景兜底(tt)。
 */
export function errText(e, fallback) {
  const msg = e?.response?.data?.message
  if (msg) return msg
  const status = e?.response?.status
  if (status) return `${tt(fallback || '操作失败')}(${status})`
  return e?.message || tt(fallback || '操作失败')
}

/** 页面动作词判定(与后端 PanelPermissionService 同源;拿不到权限一律不放行) */
export function canDoCard(user, word) {
  return canDo(user, PROC_FLOW_CARD, word)
}

/** 照片 map(键=工序序)里取某道工序的照片数组;兼容 '1'/1 两种键 */
export function photosOf(map, seq) {
  if (!map || typeof map !== 'object') return []
  const list = map[String(seq)] || map[Number(seq)]
  return Array.isArray(list) ? list : []
}
