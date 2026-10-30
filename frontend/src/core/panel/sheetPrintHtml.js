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
    for (let y = 0; y < h0; y += sliceH) {
      out.push({ index, k: kW, y, h: Math.min(sliceH, h0 - y) })
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

/**
 * 截图数组 → 完整 HTML 文档字符串。
 * @param {Array<{dataUrl:string,w0:number,h0:number}>} shots 每张纸一张（页序即打印顺序）
 * @param {string} title 文档名（<title> + 工具条文字）
 * @param {string} printLabel 「打印」按钮文字（调用方传 tt('打印')，本模块不碰 i18n）
 */
export function sheetPrintHtml(shots, title, printLabel) {
  const list = Array.isArray(shots) ? shots : []
  // 页框比内容区矮 1mm：高度正好等于内容区时，亚像素舍入会把最后一张挤到下一页、印出空白页
  const contentH = SHEET_PAGE_H - SHEET_MARGIN * 2 - 1
  const pages = list.map((s) => {
    const { w, h } = sheetImageMm(s, contentH)
    return `<div class="pg"><img src="${s.dataUrl}" style="width:${w.toFixed(2)}mm;height:${h.toFixed(2)}mm" alt=""></div>`
  }).join('')
  // 顶部工具条只在屏幕上显示：自动唤打印被浏览器压住时（窗口未聚焦等），用户还能自己点
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
