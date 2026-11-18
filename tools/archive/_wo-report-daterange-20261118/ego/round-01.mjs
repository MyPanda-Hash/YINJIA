const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="密码"]'),
  tableHeaders: [...document.querySelectorAll('.el-table__header th')].map(t => (t.textContent||'').trim()).filter(Boolean),
  queryLabels: [...document.querySelectorAll('.udl-fields .field label')].map(t => (t.textContent||'').trim()),
  sumRow: [...document.querySelectorAll('.el-table__footer td')].map(t => (t.textContent||'').trim()),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-01.png' })
