/**
 * sheetPdfA4.test.js —— 多页签/多组出纸时,每页必须是**同一张 A4 竖向纸**
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「组装工艺清单的 bom 表打印出来是横向的,和组装工艺清单的竖向不一样,
 *    可以适当调整一下 bom 表的宽度排列这些,对比这两个单的区别再做决定」
 *
 * 【实测证据(8090 · AP-2026-10-0003,见 tools/archive/_print-all-tabs-20261029/)】
 *   逐页量纸张元素:1041×(260 / 471 / 468) —— 三页**宽度完全相同**,
 *   「组装BOM表」与「组装工艺清单」两页高度只差 3px ⇒ **几何上没有区别**。
 *   真正的问题是 PDF 页面尺寸取自**内容尺寸**:
 *     format: [first.w0 * MM, first.h0 * MM]  /  addPage([pw, ph], pw > ph ? 'l' : 'p')
 *   于是每页变成 275.4mm × 69/125/124mm 的**扁横条**(实测三页 MediaBox 全是 landscape),
 *   既不是 A4、也不是同一张纸 ⇒ 打印时阅读器/打印机按各页比例自行旋转,
 *   看起来就是「一个横、一个竖」。
 *
 * 【修法】固定 A4 竖向(210×297mm)为唯一页面尺寸:每张截图等比缩放进内容区、水平居中。
 *   · 三页方向与尺寸完全一致(都是竖向 A4);
 *   · 与单页面板的 window.print() 口径一致 —— 浏览器默认也是 A4 竖向,
 *     内容按纸宽缩放 ⇒ 同一个系统的打印件观感统一;
 *   · 等比缩放不拉伸,不改变表内列宽比例。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

/** buildSheetPdfBlob 函数体(到下一个顶层函数为止),**去掉注释行**后再断言 ——
 *  否则解释"为什么不能这么做"的注释里的反例会把自己判红(2026-10-29 实测踩到)。 */
function blobFn() {
  const at = list.indexOf('async function buildSheetPdfBlob')
  assert.ok(at >= 0, '找不到 buildSheetPdfBlob')
  const end = list.indexOf('\n/** 导出 PDF', at)
  const body = list.slice(at, end > at ? end : at + 5000)
  return body
    .split(/\r?\n/)
    .filter((ln) => {
      const t = ln.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
    })
    .join('\n')
}

test('① 页面尺寸固定 A4 竖向,不再按内容尺寸出纸', () => {
  const fn = blobFn()
  assert.match(fn, /const\s+PAGE_W\s*=\s*210/, '要声明 A4 宽 210mm')
  assert.match(fn, /const\s+PAGE_H\s*=\s*297/, '要声明 A4 高 297mm')
  assert.ok(!/format:\s*\[\s*first\.w0/.test(fn),
    '不能再用首张截图的尺寸当 PDF 页面(format: [first.w0*MM, ...])')
  assert.ok(!/addPage\(\[pw,\s*ph\]/.test(fn),
    '不能再用每张截图各自的尺寸加页')
})

test('② 每一页都是 portrait(不能再按 pw > ph 判定方向)', () => {
  const fn = blobFn()
  assert.match(fn, /format:\s*\[\s*PAGE_W,\s*PAGE_H\s*\]/, '首页尺寸 = A4 竖向')
  assert.match(fn, /addPage\(\[\s*PAGE_W,\s*PAGE_H\s*\]\s*,\s*'p'\)/, '后续页同样 A4 竖向')
  assert.ok(!/pw\s*>\s*ph\s*\?\s*'l'/.test(fn), '不能再按宽高比切横向')
})

test('③ 内容等比缩放并居中(不拉伸、不贴边)', () => {
  const fn = blobFn()
  assert.match(fn, /const\s+MARGIN\s*=/, '要有页边距')
  assert.match(fn, /Math\.min\(/, '缩放比例取 min(宽比, 高比) —— 等比且不越界')
  // 居中:x = MARGIN + (可用宽 - 实际宽) / 2
  assert.match(fn, /\(\s*contentW\s*-\s*w\s*\)\s*\/\s*2/, '水平居中')
})

test('④ 仍是 mm 单位 + 96dpi 换算(px→mm 的既有口径不变)', () => {
  const fn = blobFn()
  assert.match(fn, /const\s+MM\s*=\s*25\.4\s*\/\s*96/, 'px→mm 换算保留')
  assert.match(fn, /unit:\s*'mm'/, '单位仍是 mm')
})
