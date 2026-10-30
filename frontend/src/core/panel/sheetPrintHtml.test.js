/**
 * sheetPrintHtml.test.js —— 打印页 HTML 的分页算术  2026-10-30
 *
 * 这是「打印变下载」两次踩坑后的最终方案里唯一有硬算术的部分：
 *   · 纸张 A4 210×297mm、页边距 8mm ⇒ 内容区 194×281mm；
 *   · 每张纸一页（page-break-after），最后一页不再分页（否则多印空白纸）；
 *   · 图片等比缩放进内容区，宽高按 mm 写死（与导出 PDF 的 jsPDF 布局同口径）。
 * 差 1mm 就多印一张空白页，所以逐条钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHEET_MARGIN, SHEET_MM, SHEET_PAGE_H, SHEET_PAGE_W,
  escHtml, sheetImageMm, sheetPrintHtml,
} from './sheetPrintHtml.js'

const shot = (w0, h0) => ({ dataUrl: `data:image/png;base64,AAA${w0}x${h0}`, w0, h0 })
const CONTENT_W = SHEET_PAGE_W - SHEET_MARGIN * 2      // 194mm
const CONTENT_H = SHEET_PAGE_H - SHEET_MARGIN * 2 - 1  // 280mm（留 1mm 防溢出）

test('① 纸张与换算常量：A4 竖向 + 8mm 边距 + 96dpi', () => {
  assert.equal(SHEET_PAGE_W, 210)
  assert.equal(SHEET_PAGE_H, 297)
  assert.equal(SHEET_MARGIN, 8)
  assert.ok(Math.abs(SHEET_MM - 25.4 / 96) < 1e-12)
})

test('② 宽矮的纸（如 1041×260）= 按宽度顶满内容区', () => {
  const { w, h } = sheetImageMm(shot(1041, 260))
  assert.ok(Math.abs(w - CONTENT_W) < 0.01, `宽度应顶满 ${CONTENT_W}mm，实际 ${w}`)
  assert.ok(Math.abs(h - 260 * SHEET_MM * (CONTENT_W / (1041 * SHEET_MM))) < 0.01)
  assert.ok(h < CONTENT_H, '宽矮的纸不会超高度')
})

test('③ 高瘦的纸 = 按高度顶满，且不超过 280mm（超了就会多印空白页）', () => {
  const { w, h } = sheetImageMm(shot(600, 4000))
  assert.ok(Math.abs(h - CONTENT_H) < 0.01, `高度应顶满 ${CONTENT_H}mm，实际 ${h}`)
  assert.ok(w < CONTENT_W)
  assert.ok(h <= CONTENT_H + 1e-9)
})

test('④ 脏尺寸不炸（0 / 缺字段 / 字符串）', () => {
  for (const bad of [null, undefined, {}, { w0: 0, h0: 0 }, { w0: '1041', h0: '260' }]) {
    const { w, h } = sheetImageMm(bad)
    assert.ok(Number.isFinite(w) && Number.isFinite(h), `${JSON.stringify(bad)} 应给出有限数`)
    assert.ok(w > 0 && h > 0)
  }
})

test('⑤ 每张纸一页 + 最后一页不再分页（否则末尾多一张空白纸）', () => {
  const html = sheetPrintHtml([shot(1041, 260), shot(1041, 471), shot(1041, 468)], '规格书-X', '打印')
  assert.equal((html.match(/<div class="pg">/g) || []).length, 3, '3 张纸就要 3 个页块')
  assert.match(html, /page-break-after:always/)
  assert.match(html, /\.pg:last-child\{page-break-after:auto/, '最后一页必须取消强制分页')
  assert.match(html, /@page\{size:210mm 297mm;margin:8mm\}/, '@page 必须写死 A4 毫米尺寸')
  assert.match(html, /html,body\{margin:0;padding:0/, '默认的 body 外边距会顶出一页空白')
})

test('⑥ 图片宽高按 mm 写死（与导出 PDF 逐 mm 对齐）', () => {
  const html = sheetPrintHtml([shot(1041, 260)], 'x', '打印')
  const m = /style="width:([\d.]+)mm;height:([\d.]+)mm"/.exec(html)
  assert.ok(m, '图片必须带 mm 宽高')
  assert.ok(Math.abs(Number(m[1]) - CONTENT_W) < 0.01, `宽度 ${m[1]}mm 应顶满 ${CONTENT_W}mm`)
  assert.ok(Number(m[2]) <= CONTENT_H + 0.01)
})

test('⑦ 工具条只在屏幕显示，打印时隐藏（不能占掉纸面）', () => {
  const html = sheetPrintHtml([shot(1041, 260)], 'x', '打印')
  assert.match(html, /@media print\{\.bar\{display:none\}\}/)
  assert.match(html, /onclick="window\.print\(\)"/, '自动唤打印被压住时,用户要能自己点按钮')
})

test('⑧ 标题/按钮文字要转义（单据名里可能有 & < > 引号）', () => {
  const html = sheetPrintHtml([shot(1041, 260)], '规格书-<SD-01>&"x"', '打&印')
  assert.ok(!html.includes('<SD-01>'), '标题里的 < 必须被转义')
  assert.match(html, /规格书-&lt;SD-01&gt;&amp;&quot;x&quot;/)
  assert.match(html, /打&amp;印/)
  assert.equal(escHtml("a&b<c>d\"e'f"), 'a&amp;b&lt;c&gt;d&quot;e&#39;f')
})

test('⑨ 空数组也要产出合法文档（宁可空白也不抛错）', () => {
  const html = sheetPrintHtml([], 'x', '打印')
  assert.match(html, /^<!doctype html>/)
  assert.ok(!/<div class="pg">/.test(html))
  assert.equal((sheetPrintHtml(null, 'x', '打印').match(/<body>/g) || []).length, 1)
})
