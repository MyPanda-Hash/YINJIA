const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

console.log(JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
  heads: [...document.querySelectorAll('.fields .field')].map((f) => ({ code: f.dataset.code, v: f.querySelector('input')?.value ?? '' })),
  tables: [...document.querySelectorAll('.el-table')].map((t) => ({
    rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    first: [...(t.querySelector('.el-table__body-wrapper tbody tr')?.querySelectorAll('td') || [])].slice(0, 6).map((td) => (td.innerText || '').trim()),
  })),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-17-clean.png' })
