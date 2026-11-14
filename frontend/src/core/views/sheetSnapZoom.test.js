/**
 * sheetSnapZoom.test.js —— 「立项申请表的 PDF 导出有问题，应该是完整的页面才是，面板对 A4 纸进行适配」
 *                             （2026-11-13 用户报障）
 *
 * 【现象】导出的 PDF 里，单据只占纸张**左上角一小块**，右侧和下方大片空白。
 *   （用户截图：A4 竖向纸面里，表格内容只占纸宽的 ~67%，右半边全白。）
 *
 * 【根因·浏览器实测复现（不是推断）】
 *   DocSheet 为了「窄窗口下别让 1242px 的纸撑出横向滚动条」，给纸面根节点写了**内联 zoom**
 *   （sheetZoom = 容器内宽 ÷ 纸宽，见 DocSheet.vue 的 sheetZoom/sheetStyle 注释）。
 *   而 PanelxList.snapSheetPage 截图时的做法是 `el.cloneNode(true)` ——
 *   **cloneNode 会把内联 style 里的 zoom 一起复制过去**，随后只覆盖了
 *   width / maxWidth / overflow 三个属性，zoom 留着。
 *
 *   浏览器最小复现（/tmp/harness/snap-zoom.html，ego 实跑）：
 *     原元素 zoom=1     ⇒ 克隆体 zoom=1    ⇒ 内容占截图宽 100%   ✅
 *     原元素 zoom=0.6   ⇒ 克隆体 zoom=0.6  ⇒ 内容占截图宽 **60%** ❌
 *   即：截图宽度按「未缩放的纸宽 1242px」定，但克隆体内部按 0.6 排版画
 *   ⇒ 右边 40% 是空白。与用户截图里「内容只占 2/3、右半边全白」完全吻合。
 *
 * 【修法】截图前把克隆体的 zoom 清成 1（导出件要的是**完整纸面**，不需要屏幕上的窄窗适配）。
 *   单页面板走 window.print() 那条路不受影响：打印时 CSS 用 `--print-zoom` 另算，
 *   且 sheetZoom 写的是内联 zoom（会被 print 规则的 !important 压掉）。
 *
 * 这些断言钉住「截图口径与打印口径都不许把屏幕适配缩放带进去」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

/** 截取 snapSheetPage 函数体（到下一个顶层 async function 之前） */
function snapBody() {
  const i = list.indexOf('async function snapSheetPage(')
  assert.ok(i > 0, 'PanelxList 应有 snapSheetPage')
  const rest = list.slice(i)
  const end = rest.indexOf('\nasync function shotsForPages(')
  assert.ok(end > 0, 'snapSheetPage 之后应是 shotsForPages')
  return rest.slice(0, end)
}

test('① 截图前必须把克隆体的 zoom 清成 1（cloneNode 会连内联 zoom 一起复制）', () => {
  const body = snapBody()
  assert.match(body, /clone\.style\.zoom\s*=\s*'1'|clone\.style\.zoom\s*=\s*1/,
    '必须显式把克隆体的内联 zoom 设成 1 —— 光改 width/maxWidth/overflow 不管用')
  // 顺序：清 zoom 必须在 appendChild / domToPng 之前（写成之后等于没设）
  const zi = body.indexOf("clone.style.zoom")
  const app = body.indexOf('holder.appendChild(clone)')
  assert.ok(zi > 0 && app > 0 && zi < app, '清 zoom 要在挂进 holder 之前')
})

test('② zoom 的来源可追溯：DocSheet 确实给纸面根节点写了内联 zoom', () => {
  // 这条钉的是「为什么必须清」—— 如果哪天 DocSheet 不再写内联 zoom，本修法就成了死代码，
  // 那时应当回来删掉它而不是留着两条口径。
  assert.match(docSheet, /zoomVar/, 'DocSheet 应有窄窗自适应缩放的 zoomVar')
  assert.match(docSheet, /zoom:\s*String\(sheetZoom\.value\)/, 'zoom 是写进 style 的内联值')
  assert.match(docSheet, /MIN_FIT_ZOOM/, '缩放有下限常量')
})

test('③ 导出件是完整纸面：截图宽度用纸的 scrollWidth（不乘任何缩放）', () => {
  const body = snapBody()
  assert.match(body, /Math\.max\(el\.scrollWidth,\s*el\.offsetWidth\)/,
    '纸宽取 scrollWidth/offsetWidth 的最大值（那张纸的设计宽）')
  // 别在截图宽度上再乘 zoom —— 那会把纸也缩掉
  assert.doesNotMatch(body, /w0\s*\*\s*sheetZoom|w0\s*\*\s*zoom/,
    '截图宽度不能乘缩放系数：缩放只用于屏幕显示，导出件要的是设计原尺寸')
})

test('④ 打印路径另有一套缩放（--print-zoom），不能被这里的改动影响', () => {
  assert.match(list, /--print-zoom/, '单页面板打印走 --print-zoom（CSS 变量）')
  assert.match(list, /A4_CONTENT_PX/, '打印缩放按 A4 内容宽算')
})
