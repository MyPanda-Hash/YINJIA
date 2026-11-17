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

/**
 * 按字段定义造一行空白明细 —— **新增行默认值的唯一出处**。
 *
 * 【2026-11-17 用户口径,两轮】
 *   ① 「只有不合格数量可以出现自动填 0 的情况」;
 *   ② 「新增明细行的时候会打入数据默认填 0，这个可能会帮助跳过检验」。
 *   ⇒ 新行里**小数(数量/金额)一律留空**,只有「不合格数量 / 不良数量」照旧预填 0
 *     (全合格是常态,用户明确允许);**整数保持 0**(序号/件数语义,如"加工顺序",空着反而没法排)。
 *
 * 为什么小数不能预填 0(实测踩到的链路):
 *   原来所有 小数/整数 一律 `defaultValue ?? 0`,于是来料检验单「新增数据」造出来的行
 *   **送检数量 / 合格数量都是 0**;`0` 过了"必填"这一关(空值才拦,`String(0)` 不为空),
 *   用户点「审核 / 提交审批」时静默保存就把 0 落了库 —— 一张"送检 0 / 合格 0"的检验单
 *   照样能审过去,而审核后按「合格数量 > 0 分流入库」的规则一行都进不了采购入库:
 *   看着"检验完事了",其实这批料没进系统也没退料 —— 就是用户说的"帮助跳过检验"。
 *   留空之后:红星在、必填拦得住、审核闸门(ButtonService.ensureInspOkQtyFilledForAudit)也看得见。
 *
 * @param {Array} fields 明细页签的字段定义(`dataName` / `dataType` / `defaultValue`)
 */
export function blankRowOf(fields = []) {
  const row = {}
  for (const f of fields || []) {
    if (!f || !f.dataName) continue
    if (f.dataType === '小数') {
      row[f.dataName] = f.defaultValue ?? (ZERO_PREFILL_NUMERIC.has(f.dataName) ? 0 : '')
    } else if (f.dataType === '整数') {
      row[f.dataName] = f.defaultValue ?? 0
    } else if (f.dataType === '是否') {
      row[f.dataName] = f.defaultValue ?? false
    } else {
      row[f.dataName] = f.defaultValue ?? ''
    }
  }
  return row
}

/**
 * 允许新行预填 0 的小数字段(用户 2026-11-17 口径:「只有不合格数量可以出现自动填 0 的情况」)。
 * 其余小数(送检数量 / 合格数量 / 单价 / 损耗 / 损耗率 …)一律留空,必须人工填 ——
 * 否则 0 会被当成"已填",一张没做检验的单也能审核通过(见 blankRowOf 注释里的链路)。
 */
const ZERO_PREFILL_NUMERIC = new Set(['不合格数量', '不良数量'])
