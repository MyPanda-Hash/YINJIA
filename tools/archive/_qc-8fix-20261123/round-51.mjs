// round-51: 元素级鼠标点击查询按钮(viewport 内)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.click('.header-query-dialog .el-dialog__footer .el-button--primary', { label: 'submit query' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 130),
  dialogOpen: !!document.querySelector('.header-query-dialog'),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-51-query-click.png' })
