// round-34: 鼠标点查询区内的「查询」按钮(983,656), 验证过滤生效
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.mouse.click(983 + 40, 656 + 16, { label: 'submit query panel' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
  bodyTail: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-400),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-34-detail-filtered.png' })
