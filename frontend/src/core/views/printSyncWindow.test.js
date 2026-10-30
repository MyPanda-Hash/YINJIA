/**
 * printSyncWindow.test.js —— 「打印」必须**同步**先开窗口，否则 PDF 生成完就变成下载
 *
 * 【用户原话 2026-10-30】「产品规格书打印会直接下载文件，而不是打印预览」
 *
 * 【根因】多页签/多组的纸面走 `buildSheetPdfBlob()`（html2canvas 逐页截图拼 PDF，好几秒），
 *   旧代码在 `await` **之后**才 `window.open(url, '_blank')`。等 await 回来时用户手势
 *   (transient activation) 早已过期，浏览器把它当弹窗拦掉 → 返回 null → 落进
 *   「浏览器拦截了新窗口，已改为下载 PDF」兜底 ⇒ 用户看到下载而不是预览。
 *
 * 【同一个坑踩了两次】`previewSheetPdf`（导出菜单里的「打印预览」）早就写过这条注释并用了
 *   同步先开的写法，打印路径却又写回 `window.open(url)`。故这里用测试把**两条路径一起**钉住：
 *   `window.open('', '_blank')` 必须出现在 `await buildSheetPdfBlob()` **之前**。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

/** 取一个函数的源码块（截到下一个 `\nasync function ` / `\nfunction ` 为止） */
function fnBlock(name) {
  const at = src.indexOf(`async function ${name}(`)
  assert.ok(at >= 0, `找不到 ${name}`)
  const rest = src.slice(at + 10)
  const end = rest.search(/\n(?:async )?function /)
  return src.slice(at, end < 0 ? undefined : at + 10 + end)
}

test('打印（多页签/多组）：窗口必须同步先开，再 await 生成 PDF', () => {
  const block = fnBlock('printApprovalSheet')
  const syncAt = block.indexOf("window.open('', '_blank')")
  const awaitAt = block.indexOf('await buildSheetPdfBlob()')
  assert.ok(syncAt >= 0, '打印路径没有同步先开窗口 ⇒ await 之后必被弹窗拦截，结果变成下载')
  assert.ok(awaitAt >= 0, '找不到 buildSheetPdfBlob 的调用')
  assert.ok(syncAt < awaitAt, `同步开窗(位置 ${syncAt})必须在 await(位置 ${awaitAt})之前`)
  // 旧写法：拿到 blob 之后才 open(url) —— 必须是「先开空白页，再指过去」
  assert.ok(!/window\.open\(\s*url\s*,\s*'_blank'\s*\)/.test(block),
    '不能再出现 await 之后的 window.open(url)（注释里出现可以，代码不行）')
})

test('打印预览（导出菜单）保持同一写法，别被顺手改回去', () => {
  const block = fnBlock('previewSheetPdf')
  const syncAt = block.indexOf("window.open('', '_blank')")
  const awaitAt = block.indexOf('await buildSheetPdfBlob()')
  assert.ok(syncAt >= 0 && awaitAt >= 0 && syncAt < awaitAt, 'previewSheetPdf 也必须同步先开窗口')
})

test('生成完的 blob URL 不能马上 revoke（打印对话框开着时会变白页）', () => {
  const block = fnBlock('printApprovalSheet')
  const m = /URL\.revokeObjectURL\(url\),\s*(\d+)\)/.exec(block)
  assert.ok(m, '找不到 revokeObjectURL 的延时')
  assert.ok(Number(m[1]) >= 60000, `回收延时 ${m[1]}ms 太短，打印对话框还开着 PDF 就没了`)
})
