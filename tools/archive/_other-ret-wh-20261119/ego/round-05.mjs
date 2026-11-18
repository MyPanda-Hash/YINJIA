/**
 * 第 05 轮:真实点开「退到仓库」下拉并截图(前面几轮是靠 DOM 事件改值,这一轮补一张看得见的图)。
 * 承接 round-04(其他退料页,已扫 YJ-CH-016,下拉默认 华北工控仓)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

await page.click('.mo-wh .el-select', { label: '点开退到仓库下拉' })
await page.waitForTimeout(1200)
const open = await page.evaluate(() => {
  const poppers = [...document.querySelectorAll('.el-select-dropdown')]
  const visible = poppers.filter((p) => {
    const st = getComputedStyle(p)
    return st.display !== 'none' && st.visibility !== 'hidden' && p.getBoundingClientRect().height > 0
  })
  return {
    visibleDropdowns: visible.length,
    items: visible.flatMap((d) => [...d.querySelectorAll('.el-select-dropdown__item')]
      .map((el) => (el.textContent || '').trim())),
  }
})
console.log('打开态:', JSON.stringify(open, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-05-open.png' })
console.log('截图: round-05-open.png')
