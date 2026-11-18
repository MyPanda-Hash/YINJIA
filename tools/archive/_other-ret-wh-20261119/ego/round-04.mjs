/**
 * 第 04 轮:两个对照 ——
 *  ① 其他领料(OTHER_OUT)**不该**出现「退到仓库」(领料只能从有货的仓出);
 *  ② 其他退料的下拉打开态截图(停用仓必须一个都不在)。
 */
const task = await taskSpace('other-ret-wh-20261119')
const page = task.page('p1')

// ① 其他领料
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 40000 })
await page.waitForTimeout(3500)
await page.fill('.mo-scanbar input', 'YJ-CH-016')
await page.press('.mo-scanbar input', 'Enter')
await page.waitForTimeout(4000)
const pick = await page.evaluate(() => ({
  title: (document.querySelector('.mo-title') || {}).textContent,
  candCount: document.querySelectorAll('.mo-cand').length,
  hasWhBlock: !!document.querySelector('.mo-wh'),
  cand: (document.querySelector('.mo-cand') || {}).textContent,
}))
console.log('其他领料:', JSON.stringify(pick, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-04-pick-no-wh.png' })

// ② 其他退料下拉打开态
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET', { timeout: 40000 })
await page.waitForTimeout(3500)
await page.fill('.mo-scanbar input', 'YJ-CH-016')
await page.press('.mo-scanbar input', 'Enter')
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const sel = document.querySelector('.mo-wh .el-select')
  if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
})
await page.waitForTimeout(1000)
const ret = await page.evaluate(() => ({
  whText: (document.querySelector('.mo-wh .el-select') || {}).textContent,
  options: [...document.querySelectorAll('.el-select-dropdown__item')]
    .map((el) => (el.textContent || '').trim())
    .filter((t) => t && !['全部事件', '产品开发业务流'].includes(t)),
}))
console.log('其他退料:', JSON.stringify(ret, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-ret-wh-20261119/round-04-ret-open.png' })
console.log('截图: round-04-pick-no-wh.png / round-04-ret-open.png')
