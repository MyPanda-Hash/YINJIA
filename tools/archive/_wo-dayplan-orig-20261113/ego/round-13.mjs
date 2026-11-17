// 2026-11-13 round-13:缩放页面后取证(让日期列 + 红格进画面)
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'
const SHOT = 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
async function pickLine(name) {
  await page.evaluate((n) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(n))
    if (el) el.click()
  }, name)
  await page.waitForTimeout(3500)
}
async function zoom(z) {
  await page.evaluate((v) => {
    document.body.style.zoom = String(v)
    window.dispatchEvent(new Event('resize'))
  }, z)
  await page.waitForTimeout(1500)
}
async function scrollRight(sel) {
  return page.evaluate((s) => {
    const root = document.querySelector(s)
    if (!root) return 'no-root'
    let n = 0
    root.querySelectorAll('.el-scrollbar__wrap, .el-table__body-wrapper, .el-scrollbar__view').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 10) { el.scrollLeft = el.scrollWidth; n++ }
    })
    return 'scrolled:' + n
  }, sel)
}
await pickLine('3号车间')
await zoom(0.5)
console.log('scroll3=' + (await scrollRight('.wb-main')))
await page.waitForTimeout(1200)
await page.screenshot({ path: SHOT + 'final-01z-board-3shop.png' })

await pickLine('1号车间')
await zoom(0.5)
console.log('scroll1=' + (await scrollRight('.wb-main')))
await page.waitForTimeout(1200)
const snap = await page.evaluate(() => ({
  banner: (document.querySelector('.wb-short-bar') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  redVisible: [...document.querySelectorAll('.wb-main .dp-plan.short')].map((el) => ({ t: (el.textContent || '').trim(), rect: el.getBoundingClientRect() })),
}))
console.log('1号车间=' + JSON.stringify(snap).slice(0, 1200))
await page.screenshot({ path: SHOT + 'final-02z-board-1shop.png' })

await page.evaluate(() => { location.href = '/index.html?bust=' + Date.now() + '#/prod/plan/workOrderList' })
await page.waitForTimeout(8000)
await restoreWindow()
await zoom(0.45)
console.log('scrollList=' + (await scrollRight('.wol-table')))
await page.waitForTimeout(1500)
await page.screenshot({ path: SHOT + 'final-03z-list.png' })
// 还原缩放
await page.evaluate(() => { document.body.style.zoom = '1' })
console.log('DONE')
