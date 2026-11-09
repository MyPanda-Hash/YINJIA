/**
 * labMobileApi.js — 「手机扫码 · 实验室记录手机登记」的接口封装(2026-11-09)
 *
 * 【为什么单独一个文件】页面(views/mobile/MobileLabRecord.vue)只负责交互;
 *   请求路径 / 参数名 / 解包口径收在一处(照 views/modules/plan/procFlowCardApi.js 的既有写法),
 *   将来改端点只改这里,页面不动。
 *
 * 【全部复用既有端点,不新增后端接口】
 *   · 取新单元数据  GET  /px/getNewFormPermMatrix?panelCode=…   → {data, meta, detail}
 *   · 取已有单据    GET  /px/getFormDescriptor?panelCode=…&code=… → {data, detailData}
 *   · 模糊查询/列表 POST /px/queryFormDataList                   → {totalSize, list}
 *   · 保存(草稿)   POST /px/callButton {buttonName:'保存为草稿'}   → {编号, 单据状态}
 *   · 照片          POST /attachment/upload · GET /attachment/list · POST /attachment/delete
 *                   GET  /attachment/{id}/download(浏览器直链带不了 Bearer,故走 blob)
 * 后端权限仍是既有那套(面板 view / add|modify),前端不发任何绕过权限的请求。
 */

import request from '@core/request'
import { PHOTO_FIELD } from './labMobile'

/** 单张照片大小上限(MB):与后端 yinjia.attachment.max-size-mb 默认一致,前端先挡一道给可读提示 */
export const PHOTO_MAX_MB = 20

/** ApiResult 解包:HTTP 200 但 body code≠200 时抛出带 message 的 Error */
function unpack(res) {
  if (res && typeof res.code === 'number' && res.code !== 200) {
    const e = new Error(res.message || 'request failed')
    e.code = res.code
    throw e
  }
  return res == null ? null : res.data
}

/** 新单元数据:data(默认值)+ meta(表头字段)+ detail(明细页签与字段) */
export function loadPanelMeta(panelCode) {
  return request.get('/px/getNewFormPermMatrix', { params: { panelCode } }).then(unpack)
}

/** 已有单据:data(表头值)+ detailData(明细行) */
export function loadPanelDoc(panelCode, code) {
  return request.get('/px/getFormDescriptor', { params: { panelCode, code } }).then(unpack)
}

/**
 * 模糊查询/列表。
 * 后端 keyword 同时模糊匹配**表头全部字段 + 明细全部字段**(见 QueryService.appendDocFilters),
 * 所以输测试项目、设备名、内容片段都能命中;空关键字 = 按时间倒序翻页。
 * @returns {Promise<{totalSize:number, list:any[]}>}
 */
export function queryDocs(panelCode, keyword, pageNo = 1, pageSize = 30) {
  return request
    .post('/px/queryFormDataList', {
      panelCode,
      keyword: String(keyword ?? ''),
      pageNo,
      pageSize,
      condition: {},
    })
    .then(unpack)
}

/**
 * 保存(草稿):buttonName='保存为草稿' ⇒ 单据状态=草稿,
 * 电脑端照原流程「提交审批 → 审批通过」,手机端不替用户送审。
 */
export function saveDraft(panelCode, payload) {
  return request
    .post('/px/callButton', { panelCode, buttonName: '保存为草稿', formData: payload })
    .then(unpack)
}

/**
 * 上传一张照片(POST /attachment/upload,multipart) → {files, names}
 * @param {{panelCode:string, docNo:string, fieldKey?:string, file:File}} p
 *   fieldKey 缺省 = 表头字段「手机照片」;按行存时传 `rowPhotoKey(row)`(='手机照片-<行 id>')。
 */
export async function uploadPhoto({ panelCode, docNo, fieldKey, file }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('panelCode', String(panelCode || ''))
  fd.append('docNo', String(docNo || ''))
  fd.append('field', String(fieldKey || PHOTO_FIELD))
  const res = await request.post('/attachment/upload', fd, { timeout: 120000 })
  return unpack(res)
}

/** 某单据**某字段**的全部照片 [{id,fileName,fileSize,contentType,uploader,uploadTime}]
 *  (fieldKey 同上:表的整单照片 = '手机照片',按行照片 = '手机照片-<行 id>') */
export function listPhotos(panelCode, docNo, fieldKey) {
  return request
    .get('/attachment/list', { params: { panelCode, docNo, field: String(fieldKey || PHOTO_FIELD) } })
    .then((res) => (Array.isArray(res?.data) ? res.data : []))
}

/** 删除一张照片(服务端会重新同步头字段的文件名串) */
export function deletePhoto(id) {
  return request.post('/attachment/delete', { id }).then(unpack)
}

/** 取附件字节(缩略图/预览共用;鉴权走 axios 拦截器的 Bearer token) */
export function loadAttachmentBlob(id) {
  return request.get(`/attachment/${id}/download`, { responseType: 'blob', timeout: 120000 })
}

/**
 * 错误提示文案:后端 message 优先,其次 HTTP 状态码,**并带上出错的接口路径**。
 *
 * 为什么带路径:手机端一次保存会连发好几个请求(取单 → 保存 → 逐行传照片 → 重查列表),
 * 现场只看到「Request failed with status code 500」根本不知道是哪一步挂的;
 * 附上 `[api 路径]` 后,手机上截个图就能定位(2026-11-09 排查逐行照片上传时踩到)。
 */
export function errText(e, fallback) {
  const url = e?.config?.url ? ` [${String(e.config.url)}]` : ''
  const msg = e?.response?.data?.message
  if (msg) return `${msg}${url}`
  const status = e?.response?.status
  if (status) return `${fallback || '操作失败'}(${status})${url}`
  return `${e?.message || fallback || '操作失败'}${url}`
}

/** 标准库条目(加标水「测试项目」:一个条目 = 一套明细列结构,content 是列定义 JSON)。
 *  2026-11-09 第五轮:手机端要跟电脑端一样,明细列随测试项目变,所以要读库。
 *  `all=1` 连停用条目一起取回(选项侧再按 enabled 过滤,与电脑端同口径)。 */
export function listStdLib(lib) {
  return request.get('/stdlib/list', { params: { lib, all: 1 } }).then(unpack)
}