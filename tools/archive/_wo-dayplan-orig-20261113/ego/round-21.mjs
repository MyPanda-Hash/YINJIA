// 2026-11-13 round-21:取新版三数提示条的裁切参数(全屏 + banner rect)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const OUT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
const r = await page.evaluate(() => {
  const b = document.querySelector('.wb-short-bar').getBoundingClientRect()
  return { bar: { x: b.x, y: b.y, w: b.width, h: b.height }, iw: innerWidth, ih: innerHeight, text: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() }
})
console.log('banner rect=' + JSON.stringify(r))
await page.screenshot({ path: OUT + 'full-banner-3nums.png' })
// 顺带拍 8090 打包版(其静态是旧构建,预期仍是单数合计,不作为证据)
console.log('DONE')
