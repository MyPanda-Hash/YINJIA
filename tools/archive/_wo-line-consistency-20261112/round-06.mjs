// 2026-11-12 round-06:最终展示截图(宽窗 1440x900,8090 打包版,装箱2(新厂))
const task = await taskSpace('wo-line-consistency-20261112')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1440, height: 900 } })
  }
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (el) el.click()
})
await page.waitForTimeout(5000)
const final = await page.evaluate(() => ({
  ctx: (document.querySelector('.wb-ctx-label') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  stats: (document.querySelector('.wb-ctx-stats') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
  line: (() => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null
  })(),
  rows: document.querySelectorAll('.wb-main .el-table__body tr.el-table__row').length,
}))
console.log('final=' + JSON.stringify(final, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-consistency-20261112/round-06-final-8090.png' })
