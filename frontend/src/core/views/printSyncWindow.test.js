/**
 * printSyncWindow.test.js —— 「打印 / 打印预览」必须是浏览器**原生打印预览**，不能变成下载
 *
 * 【两次踩坑，两条都钉在这里】
 *  ① 2026-10-30 一修：「产品规格书打印会直接下载文件，而不是打印预览」
 *     病根 = `await 生成 PDF` 之后才 `window.open(url)`，用户手势已过期 ⇒ 被当弹窗拦掉 ⇒
 *     落进「已改为下载 PDF」兜底。修法 = 同步先开窗口。
 *  ② 2026-10-30 二修：用户回帖「还会显示浏览器拦截了打印，改为下载…不应该是有那个打印页面吗？」
 *     截图里新标签停在 **about:blank** ⇒ 窗口开出来了，但浏览器**拒绝内联渲染 blob PDF**、
 *     直接当下载（Chrome/Edge 的「下载 PDF 而不是打开」设置，或 AlwaysOpenPdfExternally 策略）。
 *     跟有没有接打印机无关。修法 = 把每页截图写成 HTML 再 `win.print()`，全程不碰 PDF 阅读器。
 *
 * 故现在的不可回退点：
 *   · 打印/预览两条路都走 `openSheetPrint`；
 *   · `openSheetPrint` 先同步开窗、再 `collectSheetShots()`；
 *   · 页面用 `@page` 定尺寸、每张纸一页，等图片解码完再 `print()`；
 *   · 导出 PDF 与打印共用 `collectSheetShots`（版式只有一处实现）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

/** 取一个函数的源码块（截到下一个 `\nfunction `/`\nasync function ` 为止）；async 与否都认 */
function fnBlock(name) {
  const at = src.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `找不到 function ${name}`)
  const rest = src.slice(at + 10)
  const end = rest.search(/\n(?:async )?function /)
  return src.slice(at, end < 0 ? undefined : at + 10 + end)
}

test('打印与打印预览都走统一的 openSheetPrint（不再自己开窗指 blob）', () => {
  const print = fnBlock('printApprovalSheet')
  assert.match(print, /await openSheetPrint\(/, '打印入口必须调 openSheetPrint')
  assert.ok(!/win\.location\.href/.test(print), '打印入口不能再把窗口指到 blob PDF（会被当下载）')
  const preview = fnBlock('previewSheetPdf')
  assert.match(preview, /await openSheetPrint\(/, '打印预览也必须走 openSheetPrint')
  assert.ok(!/createObjectURL/.test(preview), '打印预览不该再生成 PDF blob')
})

test('openSheetPrint：同步先开窗，再等截图（否则 await 之后必被弹窗拦截）', () => {
  const block = fnBlock('openSheetPrint')
  const syncAt = block.indexOf("window.open('', '_blank')")
  const awaitAt = block.indexOf('await collectSheetShots()')
  assert.ok(syncAt >= 0, '没有同步开窗')
  assert.ok(awaitAt >= 0, '没有调用 collectSheetShots')
  assert.ok(syncAt < awaitAt, `同步开窗(位置 ${syncAt})必须在 await(位置 ${awaitAt})之前`)
  assert.match(block, /sheetPrintHtml\(/, '窗口内容必须来自 sheetPrintHtml')
  assert.match(block, /win\.print\(\)/, '最后要唤原生打印预览')
  // 等图片解码：不等就可能印出空白页
  const waitAt = block.indexOf('doc.images')
  const printAt = block.indexOf('win.print()')
  assert.ok(waitAt > 0 && waitAt < printAt, '必须先等图片加载完再 print()')
})

test('分页算术外置到 sheetPrintHtml 模块（那边有 9 条单测，别再抄回 .vue 里）', () => {
  assert.match(src, /from '@core\/panel\/sheetPrintHtml'/, '分页/纸张常量必须来自 sheetPrintHtml 模块')
  assert.match(fnBlock('openSheetPrint'), /sheetPrintHtml\(/, '窗口内容由 sheetPrintHtml 生成')
  // 纸张尺寸只能有一处真源：.vue 里不许再出现裸的 210/297 常量
  assert.ok(!/const SHEET_PAGE_W = 210/.test(src), '纸张尺寸不能在 .vue 里另写一份')
})

test('导出 PDF 与打印共用同一份走纸逻辑（版式单一来源）', () => {
  assert.match(fnBlock('buildSheetPdfBlob'), /await collectSheetShots\(\)/, 'PDF 也要走 collectSheetShots')
  assert.match(fnBlock('collectSheetShots'), /comp\?\.setActivePage/, '逐页切页签的采集逻辑还在 collectSheetShots 里')
})
