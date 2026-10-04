/**
 * detailRows.js — 「明细行住在 detail 的哪个键下」的唯一判据。
 *
 * 【为什么必须有这一处(2026-10-04 实测踩坑)】
 *   接口返回的明细键**不是**恒为 `items`,而是 yj_panel.detail_key
 *   (`QueryService.queryArchive`: `doc.put("detail", Map.of(def.tabKey(), items))`;
 *     `migrate-arch-single-doc.sql`: 档案面板 `detail_key = LOWER(panel_code)`,单据面板 = 'items')。
 *   实测:INV → detail.inv(3874 行)、EMP → detail.emp(130 行)、QC_INSP_REQ → detail.qc_insp_req(79 行),
 *        而 QC_CATALOG / QC_INSP_REC 这类单据面板 → detail.items。
 *   于是照 `head.detail.items` 写死的专属表格组件在**档案面板**上恒空:
 *   QcInspReqSheet 7 个页签全「暂无数据」、检验报告点「检验要求」恒「该物料未维护来料检验要求」
 *   —— 浏览器实测复现(见 tools/archive/_probe-qc-insp-carry/)。
 *
 * 【口径】读:优先 `items`(单据面板/合成 head),否则取 detail 里**第一个数组值**的键(与
 *   PanelxList.allArchiveRows / saveInlineDraft 的"逐键镜像"同源),再退回调用方给的 fallback
 *   (档案面板传 panelCode.toLowerCase())。写:写进同一个键 —— 保存时 PanelxList 按
 *   `Object.keys(detail)` 逐键镜像提交,键错位会让新行既不在表里也不在提交内容里。
 */

/** detail 里存着明细行的键(拿不到再退回 fallbackKey,最后退回 'items') */
export function detailKeyOf(head, fallbackKey = '') {
  const d = head?.detail
  const fb = fallbackKey || 'items'
  if (!d || typeof d !== 'object') return fb
  if (Array.isArray(d.items)) return 'items'
  for (const [k, v] of Object.entries(d)) if (Array.isArray(v)) return k
  return fb
}

/** 只读取明细行(不创建);head 结构不对给空数组 */
export function detailRowsOf(head, fallbackKey = '') {
  const d = head?.detail
  if (!d || typeof d !== 'object') return []
  const key = detailKeyOf(head, fallbackKey)
  return Array.isArray(d[key]) ? d[key] : []
}

/** 取**可写**的明细行数组(必要时建 detail 与那个键);新增行必须走这里,键才不会错位 */
export function ensureDetailRows(head, fallbackKey = '') {
  if (!head.detail || typeof head.detail !== 'object') head.detail = {}
  const key = detailKeyOf(head, fallbackKey)
  if (!Array.isArray(head.detail[key])) head.detail[key] = []
  return head.detail[key]
}
