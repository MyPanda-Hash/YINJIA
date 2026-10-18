/**
 * reportQuery.js — 库存报表「查询弹窗」(reportQueryDialog)的**纯逻辑层**。
 *
 * 适用面板:`yj_panel` 里 STOCK_LEDGER(库存台账)/ STOCK_SUMMARY(收发存汇总表)
 *   —— 服务端 PanelConfigService 给它们 metadata.reportQueryDialog = true,T+ 同款:
 *   **进入面板先弹条件弹窗**(单据日期区间必填 [+ 台账的仓库/存货必填]),关闭弹窗即退出页面。
 *
 * 为什么单独抽一个文件(2026-10-20 用户报障「库存台账和收发存汇总表出现重复弹窗和查询问题」):
 *   弹窗门原先散落在 PanelxList.vue 的 `load()` 里,判据是 `reportQueryDialog && !rqdDone`;
 *   而 `load()` 在一个面板生命周期里会被 **十几处** 调用(切面板、刷新、分页、保存后、导入后、
 *   列设置保存后…),门又只按 `rqdDone`(票)而不是按「弹窗本来就开着」判 ⇒
 *   一次「进入 → 查询 → 后台又触发一次 load」就能把弹窗重新顶出来,界面上的观感就是
 *   「弹窗关了又弹 / 连弹两次」,而用户此前填的条件已经被清掉。同理,重复查询靠的是同一条门。
 *   ⇒ 把「要不要弹、开之前要重置什么、账怎么记」全部收成纯函数并单测钉死,
 *     组件里只留"照着做"的一行调用(不能再出现第二处判据)。
 *
 * 判定口径(三条,缺一不可):
 *   ① 只有真·报表查询弹窗面板(reportQueryDialog === true)才走门;台账/汇总以外一律不弹。
 *   ② 已有一次成功查询(hasApplied)→ 后续任何 load 都不再弹。
 *   ③ 从没查询过但弹窗**正开着** → 也不弹(否则同一个弹窗会被重开两次,即"重复弹窗")。
 */

/** 走「进入即弹查询弹窗」的面板(与 PanelConfigService 下发的 reportQueryDialog 同源) */
export const REPORT_QUERY_DIALOG_PANELS = ['STOCK_LEDGER', 'STOCK_SUMMARY']

/** 必须「一个仓库 + 一种存货」才能查的面板(台账按仓分户;汇总可选填仓库,故不在此) */
export const REPORT_QUERY_REQUIRED_PANELS = ['STOCK_LEDGER']

/** 默认区间 = 「本月初 → 今天」(本地时区,YYYY-MM-DD)。T+ 报表同款默认值口径 */
export function defaultReportRange(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(d)}`]
}

/**
 * 面板是否走「进入即弹查询弹窗」。
 * @param {string} panelCode
 * @param {boolean} metadataFlag 服务端 metadata.reportQueryDialog
 */
export function reportQueryDialogOn(panelCode, metadataFlag) {
  return metadataFlag === true
}

/**
 * 现在该不该自动弹条件弹窗。
 * @param {object} s
 * @param {boolean} s.enabled        面板是否走弹窗门(见 reportQueryDialogOn)
 * @param {boolean} s.hasApplied     本面板本轮是否已成功查询过一次(即 rqdDone)
 * @param {boolean} s.dialogVisible  弹窗当前是否已打开
 * @param {string}  s.panelCode      当前面板号(空/undefined = 已离开面板,一律不弹)
 */
export function shouldAutoOpenReportQuery(s = {}) {
  if (!s.enabled) return false
  if (!s.panelCode || s.panelCode === 'undefined') return false
  if (s.hasApplied) return false
  if (s.dialogVisible) return false // 已在弹窗里:再开一次就是「重复弹窗」
  return true
}

/**
 * 查询条件必填校验。
 * @param {object} s
 * @param {string}    s.panelCode
 * @param {string[]}  s.range      [开始日期, 结束日期]
 * @param {string}    s.wh         仓库(名称)
 * @param {string}    s.item       存货(名称)
 * @returns {{ok:true} | {ok:false, reason:'range'|'whItem'}}  reason 由调用方映射文案
 */
export function validateReportQuery({ panelCode, range, wh, item } = {}) {
  const [ds, de] = Array.isArray(range) ? range : []
  if (!ds || !de) return { ok: false, reason: 'range' }
  if (REPORT_QUERY_REQUIRED_PANELS.includes(panelCode) && (!wh || !item)) {
    return { ok: false, reason: 'whItem' }
  }
  return { ok: true }
}

/**
 * 把弹窗草稿整理成后端 condition:去掉空值(undefined / null / 空串)。
 *
 * ⚠ 控制键(`_whCode` / `_itemCode` / `_whCodes` …)**必须原样保留** —— 台账按编码精确过滤
 *   全靠它们(名称只作弹窗回显:仓库「成品仓」LIKE 会串到「半成品仓」)。2026-10-20 一度写成
 *   "顺手丢掉 `_` 开头的键",台账立刻退化成"只剩期初+期末两行",故这里只做去空值。
 */
export function cleanCondition(draft = {}) {
  const out = {}
  for (const [k, v] of Object.entries(draft || {})) {
    if (v === undefined || v === null || String(v) === '') continue
    out[k] = v
  }
  return out
}
