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
  escHtml, planSheetPages, sheetImageMm, sheetPrintHtml,
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

test('⑥ 图片宽高按 mm 写死 + 可缩（与导出 PDF 逐 mm 对齐，但用户页边距更大时不许被裁）', () => {
  const html = sheetPrintHtml([shot(1041, 260)], 'x', '打印')
  const m = /style="width:([\d.]+)mm;height:auto;max-width:100%"/.exec(html)
  assert.ok(m, '图片应带 mm 宽度 + height:auto + max-width:100%')
  assert.ok(Math.abs(Number(m[1]) - CONTENT_W) < 0.01, `宽度 ${m[1]}mm 应顶满 ${CONTENT_W}mm`)
  const dh = /data-h="([\d.]+)mm"/.exec(html)
  assert.ok(Number(dh[1]) <= CONTENT_H + 0.01, '高度(记录值)不得超过内容区')
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

/* ── 长页切张（2026-10-30「这一页太窄」「最后一页字体乱」的修法）── */
test('⑩ 正常页不分张：一张截图 = 一张纸，比例仍是「塞进一张」', () => {
  const plan = planSheetPages([shot(794, 700)])
  assert.equal(plan.length, 1, '矮于一页的纸不能被切开')
  assert.equal(plan[0].y, 0)
  assert.equal(plan[0].h, 700)
  assert.ok(plan[0].k > 0.9, `按宽度铺满（k≈${plan[0].k}）`)
})

test('⑪ 长表按宽度铺满分张：26 组检验项那种高页不能整张缩成糊字', () => {
  // 794px 宽(=A4 210mm)、3000px 高的长表
  const plan = planSheetPages([shot(794, 3000)])
  assert.ok(plan.length >= 2, `应切成多张，实际 ${plan.length}`)
  // 每张都按宽度铺满（同一比例 ⇒ 张与张之间不会一大一小）
  const k0 = plan[0].k
  for (const p of plan) assert.ok(Math.abs(p.k - k0) < 1e-9, '所有分张必须同一比例')
  assert.ok(Math.abs(k0 - CONTENT_W / (794 * SHEET_MM)) < 1e-9, `按宽度铺满：k=${k0}`)
  // 覆盖完整、不重不漏
  assert.equal(plan[0].y, 0)
  for (let i = 1; i < plan.length; i++) {
    assert.ok(Math.abs(plan[i].y - (plan[i - 1].y + plan[i - 1].h)) < 1e-6, '分张必须首尾相接')
  }
  const last = plan[plan.length - 1]
  assert.ok(Math.abs(last.y + last.h - 3000) < 1e-6, '最后一张必须取到表尾')
  // 每张的高度换算成 mm 都不能超过内容区（否则会多印空白纸）
  for (const p of plan) assert.ok(p.h * SHEET_MM * p.k <= 281 + 0.01, '单张不得高过纸面内容区')
})

test('⑫ 多张截图各算各的（封面矮、检验表长，互不影响）', () => {
  const plan = planSheetPages([shot(794, 700), shot(794, 3000), shot(794, 400)])
  const byIndex = (i) => plan.filter((p) => p.index === i)
  assert.equal(byIndex(0).length, 1)
  assert.ok(byIndex(1).length >= 2)
  assert.equal(byIndex(2).length, 1)
  // 顺序必须与页序一致（打印按页序出纸）
  const order = plan.map((p) => p.index)
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
})
