/**
 * printSyncWindow.test.js —— 打印/打印预览必须走**页面内打印层**，绝不开新窗口
 *
 * 【三次踩坑，全钉在这里】
 *  ① 2026-10-30 一修：「产品规格书打印会直接下载文件，而不是打印预览」
 *     病根 = `await 生成 PDF` 之后才 `window.open(url)`，用户手势已过期 ⇒ 被当弹窗拦掉。
 *     当时的修法 = 同步先开窗口。
 *  ② 2026-10-30 二修：窗口开出来了，但浏览器**拒绝内联渲染 blob PDF**、直接当下载
 *     （「下载 PDF 而不是打开」设置 / AlwaysOpenPdfExternally 策略）。修法 = 写 HTML 再 `win.print()`。
 *  ③ 2026-11-04 三修（客户现场）：**弹窗白名单加了也没用** —— 客户在
 *     「设置 → 网站权限 → 弹出窗口和重定向 → 允许发送弹出窗口」里加了站点，
 *     点 tap 页「打印」仍弹「浏览器拦截了新窗口，请允许弹出窗口」。
 *     说明 `window.open`（尤其空 URL 的 about:blank）在客户机器上根本走不通：
 *     广告拦截插件、企业策略(DefaultPopupsSetting)、内嵌 WebView 都可能挡，
 *     而白名单只管"站点弹窗"，管不到这些。
 *     ⇒ 修法 = **彻底不开窗**，改用全系统唯一出纸通道 `printInPage`
 *       （页面内打印层 + window.print()），与《开发与质量》M1
 *       「全系统只有一条出纸通道 = printInPage，不许再新写 window.open 打印」对齐。
 *
 * 故现在的不可回退点：
 *   · 打印/预览两条路都走 `openSheetPrint`；
 *   · `openSheetPrint` **不许出现 window.open**，先 `collectSheetShots()` 再 `printInPage(...)`；
 *   · 打印页 HTML 由 `sheetPrintBody` 生成（@page 定尺寸、每张纸一页）；
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

test('openSheetPrint 绝不开窗：客户把站点加进弹窗白名单仍被拦，只有页面内打印层能根治', () => {
  const block = fnBlock('openSheetPrint')
  assert.ok(!/window\.open/.test(block), 'openSheetPrint 里不许再出现 window.open（客户现场实测白名单无效）')
  assert.ok(!/win\.print\(\)/.test(block), '不再有子窗口，也就没有 win.print()')
  assert.match(block, /printInPage\(/, '出纸必须走全系统统一通道 printInPage')
  assert.match(block, /await collectSheetShots\(\)/, '先逐页截图再打印')
  assert.match(block, /sheetPrintBody\(/, '打印内容由 sheetPrintBody 生成')
  // printInPage 返回 false = 浏览器连打印都拒了，此时必须如实提示，不能装作成功
  assert.match(block, /if \(!ok\)|!ok\)/, 'printInPage 失败要提示')
})

test('分页算术外置到 sheetPrintHtml 模块（那边有单测，别再抄回 .vue 里）', () => {
  assert.match(src, /from '@core\/panel\/sheetPrintHtml'/, '分页/纸张常量必须来自 sheetPrintHtml 模块')
  assert.match(fnBlock('openSheetPrint'), /sheetPrintBody\(/, '打印内容由 sheetPrintBody 生成')
  // 纸张尺寸只能有一处真源：.vue 里不许再出现裸的 210/297 常量
  assert.ok(!/const SHEET_PAGE_W = 210/.test(src), '纸张尺寸不能在 .vue 里另写一份')
})

test('导出 PDF 与打印共用同一份走纸逻辑（版式单一来源）', () => {
  assert.match(fnBlock('buildSheetPdfBlob'), /await collectSheetShots\(\)/, 'PDF 也要走 collectSheetShots')
  assert.match(fnBlock('collectSheetShots'), /comp\?\.setActivePage/, '逐页切页签的采集逻辑还在 collectSheetShots 里')
})
