/**
 * sheetPrintHtml.js —— 把「每张纸一张截图」变成**可直接打印的 HTML 文档**（纯函数，无 Vue/无 DOM）
 * 2026-10-30
 *
 * 【为什么需要它】打印/打印预览两次踩坑后定下的做法：
 *   ① 生成 PDF blob → 新窗口 → 交给浏览器 PDF 阅读器：用户机器上浏览器把 blob PDF 当**下载**，
 *      标签页停在 about:blank（「下载 PDF 文件，而不是自动在浏览器中打开」设置 /
 *      AlwaysOpenPdfExternally 策略）。这跟有没有连接打印机无关。
 *   ② 现在：把截图写成一张 HTML（A4 版面、每张纸一页、图片宽高按毫米写死），
 *      再 `win.print()` 唤起浏览器**原生打印预览** —— 全程不经过 PDF 阅读器。
 *
 * 【为什么单独成模块】分页算术是这个方案唯一的硬骨头（差 1mm 就多印一张空白页），
 *   必须能被单测直接断言；埋在 .vue 里只能靠"读源码断言"这种弱办法。
 *
 * 【与导出 PDF 同口径】纸张 210×297mm、页边距 8mm、96dpi 换算，导出 PDF 也用这几个常量
 *   （那里是 jsPDF 的 mm 布局），保证打印件与导出件逐 mm 一致。
 */

import { PRINT_HOST_ID } from './printChannel.js'

export const SHEET_PAGE_W = 210        // A4 竖向宽(mm)
export const SHEET_PAGE_H = 297        // A4 竖向高(mm)
export const SHEET_MARGIN = 8          // 页边距(mm),与 CSS @page { margin } 同口径
export const SHEET_MM = 25.4 / 96      // 截图 px → mm(96dpi)

/**
 * 一张截图缩到不足「按宽度铺满」的 80% 时，说明它是被**高度**卡住的长表
 * （实测：规格书「检验项目及标准」26 组检验项、成品及包装运输 6 段文字），
 * 硬塞进一张 A4 只能整体缩小 ⇒ 字变成糊的一团（用户 2026-10-30
 * 「这一页有点窄」「最后一页字体还乱了」）。这种页改为**纵向切张**，按宽度铺满、跨几张纸。
 */
export const SHEET_SPLIT_RATIO = 0.8

/**
 * 每张截图要印成几张纸、每张取哪一段（纯算术，不碰 DOM）。
 * @returns {Array<{index:number, k:number, y:number, h:number}>} y/h 单位为截图**原始 CSS px**
 */
/**
 * 把理想切点吸附到**最近的块边界**（行底边），避免把一行切成两半（2026-11-13）。
 *
 * 只在「吸附后这一页仍然装得下」时才吸：候选边界必须 ≤ 理想切点，
 * 且不能比上一页已经用掉的位置还靠前（否则会切出空页/死循环）。
 * 找不到合适边界就退回理想切点（宁可切一半，也不能丢内容）。
 *
 * @param {number} ideal 理想切点（CSS px，相对截图顶部）
 * @param {number[]} breaks 块边界（升序，CSS px）
 * @param {number} from 本页起点（切点必须 > from）
 * @returns {number} 实际切点
 */
export function snapToRowBreak(ideal, breaks, from = 0) {
  const list = (Array.isArray(breaks) ? breaks : [])
    .filter((b) => Number.isFinite(b) && b > from && b <= ideal)
  if (!list.length) return ideal
  return list[list.length - 1]          // 升序 ⇒ 最后一个就是最靠近理想切点的
}

export function planSheetPages(shots) {
  const contentW = SHEET_PAGE_W - SHEET_MARGIN * 2
  // 与 sheetPrintHtml 的页框同口径（比内容区矮 1mm，防亚像素溢出）
  const contentH = SHEET_PAGE_H - SHEET_MARGIN * 2 - 1
  const out = []
  const list = Array.isArray(shots) ? shots : []
  list.forEach((s, index) => {
    const w0 = Math.max(1, Number(s?.w0) || 0)
    const h0 = Math.max(1, Number(s?.h0) || 0)
    const kW = contentW / (w0 * SHEET_MM)          // 按宽度铺满的比例
    const kFit = Math.min(kW, contentH / (h0 * SHEET_MM))
    if (kFit >= kW * SHEET_SPLIT_RATIO) {
      out.push({ index, k: kFit, y: 0, h: h0 })
      return
    }
    const sliceH = contentH / kW / SHEET_MM        // 一张纸能放多少 CSS px
    const breaks = Array.isArray(s?.rowBreaks) ? s.rowBreaks : []
    // ⚠ 逐页推进（不是 `for (y += sliceH)`）：吸附会改变每页实际切点，步长不再固定。
    //   进度保证：snapToRowBreak 只会返回 > y 的值，最坏退回 ideal，故必然推进。
    let y = 0
    let guard = 0
    while (y < h0 && guard < 500) {
      guard += 1
      const ideal = Math.min(y + sliceH, h0)
      // 最后一页（剩余不足一张纸）直接到底，不吸附
      const cut = ideal >= h0 ? h0 : snapToRowBreak(ideal, breaks, y)
      out.push({ index, k: kW, y, h: cut - y })
      y = cut
    }
  })
  return out
}


/** HTML 文本转义（标题/按钮文字可能是「规格书-<单据号>&…」） */
export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/**
 * 单张截图 → 打印时的毫米尺寸（等比缩放进内容区，取较小的那个比例，与 jsPDF 的算法一致）。
 * @param {{w0:number,h0:number}} shot 截图原始像素尺寸
 * @param {number} [contentH] 内容区高度(mm)；打印用 280（比真实 281 少 1mm 防亚像素溢出），
 *                            导出 PDF 用 281 —— 故做成参数而不是写死。
 */
export function sheetImageMm(shot, contentH = SHEET_PAGE_H - SHEET_MARGIN * 2 - 1) {
  const contentW = SHEET_PAGE_W - SHEET_MARGIN * 2
  const iw = Math.max(1, Number(shot?.w0) || 0) * SHEET_MM
  const ih = Math.max(1, Number(shot?.h0) || 0) * SHEET_MM
  const k = Math.min(contentW / iw, contentH / ih)
  return { w: iw * k, h: ih * k }
}

/** 内容区高度(mm)：比真实内容区矮 1mm，防亚像素舍入把最后一张挤到下一页、印出空白纸 */
const CONTENT_H = SHEET_PAGE_H - SHEET_MARGIN * 2 - 1

/** 每张纸一个 `.pg` 块（两个出口共用这一份，版式不许各写一份） */
function pagesHtml(shots) {
  const list = Array.isArray(shots) ? shots : []
  // 页框比内容区矮 1mm：高度正好等于内容区时，亚像素舍入会把最后一张挤到下一页、印出空白页
  const contentH = CONTENT_H
  return list.map((s) => {
    const { w, h } = sheetImageMm(s, contentH)
    // ⚠ width 用 mm 写死（与导出 PDF 逐 mm 对齐），但必须带 max-width:100%：
    //   打印对话框里的纸张/页边距是**用户环境**决定的（实测有 1 英寸 = 25.5mm 边距的），
    //   那时可打印宽只有 ~159mm；图片若仍按 194mm 铺，两侧会被打印机裁掉
    //   （2026-10-30 用户截图：序号列只剩「号」、备注列只剩「备」）。
    //   height 交给 auto，等比跟着缩，绝不变形。
    return `<div class="pg"><img src="${s.dataUrl}" style="width:${w.toFixed(2)}mm;height:auto;max-width:100%" alt="" data-h="${h.toFixed(2)}mm"></div>`
  }).join('')
}

/**
 * 截图数组 → 打印正文片段（`<style>…</style>` + 每张纸一个 `.pg`），交给 `printInPage` 用。
 *
 * 2026-11-04 新增：出纸通道从「子窗口 + win.print()」改成**页面内打印层**。
 *   客户现场实测：把站点加进浏览器「允许弹出窗口」白名单后，tap 页打印**仍然**报
 *   「浏览器拦截了新窗口」⇒ `window.open` 这条路在客户环境根本走不通（广告拦截插件、
 *   企业策略 DefaultPopupsSetting、内嵌 WebView 都能挡，白名单管不到）。
 * 分页算术与 sheetPrintHtml 共用 pagesHtml，没有第二份实现。
 *
 * ⚠ 样式选择器一律收在 `#yj-print-host` 下：这段 CSS 进的是**主页面**文档，
 *   不收窄就会和全局样式/其它打印层撞车（《开发与质量》M4）。
 */
export function sheetPrintBody(shots) {
  const host = `#${PRINT_HOST_ID}`
  return `<style>
@page{size:${SHEET_PAGE_W}mm ${SHEET_PAGE_H}mm;margin:${SHEET_MARGIN}mm}
${host} .pg{height:${CONTENT_H}mm;display:flex;justify-content:center;align-items:flex-start;page-break-after:always;break-after:page}
${host} .pg:last-child{page-break-after:auto;break-after:auto}
${host} .pg img{display:block}
</style>${pagesHtml(shots)}`
}

/**
 * 截图数组 → 完整 HTML 文档字符串。
 *
 * ⚠ 2026-11-04 起**生产代码不再用它**（出纸改走 printInPage，只需 body 片段），
 *   保留是因为单测把它当「分页算术的规格」逐条断言（@page / 一页一纸 / 末页不分页）。
 *   谁想再开子窗口打印，先读《开发与质量》M1 与 PanelxList.vue 的 openSheetPrint 注释。
 * @param {Array<{dataUrl:string,w0:number,h0:number}>} shots 每张纸一张（页序即打印顺序）
 * @param {string} title 文档名（<title> + 工具条文字）
 * @param {string} printLabel 「打印」按钮文字（调用方传 tt('打印')，本模块不碰 i18n）
 */
export function sheetPrintHtml(shots, title, printLabel) {
  const contentH = CONTENT_H
  const pages = pagesHtml(shots)
  // 顶部工具条只在屏幕上显示：自动唤打印被压住时（窗口未聚焦等），用户还能自己点
  const bar = '<div class="bar"><span class="tt">' + escHtml(title) + '</span>'
    + `<button type="button" onclick="window.print()">${escHtml(printLabel)}</button></div>`
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + `<title>${escHtml(title)}</title><style>`
    + `@page{size:${SHEET_PAGE_W}mm ${SHEET_PAGE_H}mm;margin:${SHEET_MARGIN}mm}`
    + 'html,body{margin:0;padding:0;background:#fff;'
    + '-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.bar{display:flex;gap:12px;align-items:center;justify-content:center;padding:8px 12px;'
    + 'font:13px/1.5 "Microsoft YaHei",sans-serif;color:#303133;background:#f5f7fa;'
    + 'border-bottom:1px solid #e4e7ed}'
    + '.bar button{padding:4px 16px;border:1px solid #0d5bd3;background:#0d5bd3;color:#fff;'
    + 'border-radius:4px;cursor:pointer;font-size:13px}'
    + '@media print{.bar{display:none}}'
    + `.pg{height:${contentH}mm;display:flex;justify-content:center;align-items:flex-start;`
    + 'page-break-after:always;break-after:page}'
    + '.pg:last-child{page-break-after:auto;break-after:auto}'
    + '.pg img{display:block}'
    + `</style></head><body>${bar}${pages}</body></html>`
}
