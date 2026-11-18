const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')].slice(0, 6).map((f) => ({
    label: (f.querySelector('label') || {}).textContent,
    html: f.innerHTML.slice(0, 300),
  }))
  return {
    hash: location.hash,
    dateFieldHtml: fields.find((f) => (f.label || '').includes('单据日期')),
    fields: fields.map((f) => f.label),
    footer: [...document.querySelectorAll('.el-table__footer td')].map((t) => (t.textContent || '').trim()),
    count: (document.querySelector('.report-count') || {}).textContent,
    heading: (document.querySelector('.report-heading') || {}).textContent,
    consoleReady: true,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-14.png' })
