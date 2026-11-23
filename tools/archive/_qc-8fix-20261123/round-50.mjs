// round-50: 正确坐标鼠标点「单据编号」输入 + 提交查询
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.mouse.click(560, 186, { label: 'focus 单据编号' })
await page.waitForTimeout(300)
await page.keyboard.insertText('ZC-2026-11-0008')
await page.waitForTimeout(500)
console.log('input:', await page.evaluate(() => [...document.querySelectorAll('.header-query-dialog input.el-input__inner')].map((i) => i.value).filter(Boolean)))
await page.mouse.click(1026, 570, { label: 'submit query' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 130),
  dialogOpen: !!document.querySelector('.header-query-dialog'),
  activeChip: (document.body.innerText || '').includes('单据编号'),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-50-query-filtered.png' })
