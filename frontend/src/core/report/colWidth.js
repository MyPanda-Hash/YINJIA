/**
 * colWidth.js —— 报表面板列宽「按内容自适应」的纯函数(2026-11-23 用户口径)
 *
 * 【用户口径】「这些最基础的内容需要默认完全展开而不是关闭的」——附截图:
 *   《出货检验（功能）明细表》里 单据编号 / 工单号 / 产品名称 / 规格型号 全被省略号截断。
 *
 * 【根因】列表页报表表格(PanelxList.vue 的 `.report-table`)的列宽只按**列名字数**推算:
 *   `colW()` 对 2 字以上中文列一律给 96px ⇒ 值比列名长就一定省略号。
 *   2026-11-23 实测(100 行/页):
 *     单据编号 100/100 行、工单号 97/100、产品名称 91/100、规格型号 70/100 行被截断。
 *
 * 【口径】(见 fitColWidth)
 *   宽 = max(列名宽, yj_field.width, 当前页真实内容宽 + 单元格内边距),上限 REPORT_COL_MAX;
 *   撞上限的列(长段落,如「检验要求」实测 741px)改走**换行**全文显示(调用方置 wrap)。
 *
 * 放在 core/report 下而不是塞回 PanelxList.vue(已 1.6 万行),纯函数可单测。
 */

/** 列宽上限:再长就换行,不无限加宽(整表宽度 = Σ 列宽,过宽只能横向滚动) */
export const REPORT_COL_MAX = 360

/** 单元格左右内边距 + 边框余量(el-table `.cell{padding:0 12px}`,再加一点容错) */
const CELL_PAD = 30

/**
 * 12px 表格里一段文字的显示宽度估算。
 * 全角/CJK ≈ 12.2px、半角 ≈ 6.8px —— **按偏大取值**:
 * 2026-11-23 实测偏小 2px 仍会出省略号(材料仓条码管理「CGRK-20261014-03414」145px 列差 2px 就截)。
 */
export function textPx(text) {
  let w = 0
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0)
    w += c > 0x2e7f && c < 0xffef ? 12.2 : 6.8
  }
  return w
}

/** 一批单元格值里最宽的那条(空值跳过) */
export function contentPx(values) {
  let max = 0
  for (const v of values || []) {
    if (v === null || v === undefined || v === '') continue
    max = Math.max(max, textPx(v))
  }
  return max
}

/**
 * 报表列宽:列名宽(旧口径) / yj_field.width / 内容宽 三者取大,再按上限截。
 * @param {number} baseW  列名推算宽(旧 colW,保底)
 * @param {number} metaW  yj_field.width(0/空 = 没配)
 * @param {Array}  values 当前页该列的值
 */
export function fitColWidth(baseW, metaW, values) {
  const byData = contentPx(values)
  const need = Math.max(Number(baseW) || 0, Number(metaW) || 0, byData ? byData + CELL_PAD : 0)
  return Math.min(need, REPORT_COL_MAX)
}

/** 该列是否「内容比上限还长」⇒ 调用方应关掉省略号、让单元格换行全文显示 */
export function needsWrap(width) {
  return (Number(width) || 0) >= REPORT_COL_MAX
}
