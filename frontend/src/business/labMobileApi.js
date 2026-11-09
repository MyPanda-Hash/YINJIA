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

/** 上传一张照片(POST /attachment/upload,multipart) → {files, names} */
export async function uploadPhoto({ panelCode, docNo, file }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('panelCode', String(panelCode || ''))
  fd.append('docNo', String(docNo || ''))
  fd.append('field', PHOTO_FIELD)
  const res = await request.post('/attachment/upload', fd, { timeout: 120000 })
  return unpack(res)
}

/** 某单据的全部手机照片 [{id,fileName,fileSize,contentType,uploader,uploadTime}] */
export function listPhotos(panelCode, docNo) {
  return request
    .get('/attachment/list', { params: { panelCode, docNo, field: PHOTO_FIELD } })
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
