const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => {
  const field = [...document.querySelectorAll('.udl-fields .field')].find((f) => (f.querySelector('label') || {}).textContent?.includes('单据日期'))
  return {
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
    count: (document.querySelector('.report-count') || {}).textContent,
    heading: (document.querySelector('.report-heading') || {}).textContent,
    rangeInputs: field ? [...field.querySelectorAll('input')].map((i) => ({ cls: i.className, ph: i.placeholder, val: i.value })) : null,
    hasRange: !!document.querySelector('.query-date-range'),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-16.png' })
