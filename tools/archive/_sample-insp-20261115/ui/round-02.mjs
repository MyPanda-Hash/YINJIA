/* round-02:两面板截图取证(顺序打开,导航失败重试)+ 目录行数 */
const task = await taskSpace('sample-insp-20261115')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function gotoRetry(hash, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      await page.goto(BASE + '/#' + hash, { timeout: 45000 })
      await page.waitForTimeout(3500)
      await restoreWindow()
      const h = await page.evaluate(() => location.hash)
      if (h === hash) return true
      console.log('goto mismatch:', h)
    } catch (e) { console.log('goto retry ' + i + ': ' + e.message) }
    await page.waitForTimeout(1500)
  }
  return false
}

await gotoRetry('/panelx/list/INSP_COMMISSION')
await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  if (el) el.scrollIntoView({ block: 'start' })
})
await page.waitForTimeout(600)
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-01-commission-paper.png', fullPage: false })
console.log('shot1 ok')

const ok2 = await gotoRetry('/panelx/list/SAMPLE_REG')
console.log('catalog nav:', ok2)
const info = await page.evaluate(() => ({
  hash: location.hash,
  gridRows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
  firstRows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140)),
  total: (document.querySelector('.el-pagination__total')?.textContent || '').trim(),
  headers: [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').trim()).filter(Boolean).slice(0, 14),
}))
console.log('SAMPLE_REG:', JSON.stringify(info, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-02-catalog.png', fullPage: false })
await task.finish({ keep: true })
