/**
 * qcInspReqApi.js — 来料检验要求(QC_INSP_REQ)取数的唯一入口。
 *
 * 这份取数原本只写在「按物料编码查看检验要求」弹窗里(2026-09-23);检验报告要按同一口径
 * 带入检验项(2026-10-04),两处**必须同源** —— 弹窗看到的行与报告带入的行不允许有差别,
 * 故抽到这里由两边共用(防复制粘贴走样)。
 *
 * 档案式面板:整表一张虚拟单(head.detail.items 全量行),服务端按 condition 收窄,
 * 即便不收窄也在前端按 物料编号 精确过滤(见 qcInspReqLookup)。
 */
import request from '@/core/request'
import { detailRowsOf } from '@core/panel/detailRows'
import { normCode } from './qcInspReqLookup.js'

/** 来料检验要求面板码(档案式:整表一张虚拟单,行在 detail.items) */
export const QC_INSP_REQ_PANEL = 'QC_INSP_REQ'
/** 档案面板的明细键 = LOWER(panel_code)(实测接口返回 detail.qc_insp_req,不是 items) */
export const QC_INSP_REQ_DETAIL_KEY = 'qc_insp_req'

/**
 * 取该物料在「来料检验要求」里的全部行(未过滤;分组/匹配交给 qcInspReqLookup)。
 * @param {string} materialCode 物料编码/编号(两侧 trim 后精确匹配)
 * @returns {Promise<Array<object>>} 要求行(空编码或没命中给空数组)
 */
export async function fetchReqRows(materialCode) {
  const code = normCode(materialCode)
  if (!code) return []
  const res = await request.post('/px/queryFormDataList', {
    panelCode: QC_INSP_REQ_PANEL,
    condition: { 物料编号: code },
    pageNo: 1,
    pageSize: 1,
  })
  const doc = res?.data?.list?.[0]
  // ⚠ 明细键 = yj_panel.detail_key = 'qc_insp_req'(档案面板),**不是** items ——
  //   照 detail.items 取会恒空,报表现象就是「该物料未维护来料检验要求」(见 detailRows.js 说明)
  return detailRowsOf(doc, QC_INSP_REQ_DETAIL_KEY)
}
