/** 收尾:确认 ego 浏览器停在**正式库**的采购入库单列表(把之前测试切换的登录态还原) */
const task = await taskSpace('erp-dedup-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => {
  const brand = document.querySelector('.brand, .logo, .topbar')
  const chip = document.querySelector('.doc-chip')
  return {
    hash: location.hash,
    brand: brand ? (brand.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '',
    docChip: chip ? chip.textContent.trim() : '',
    isLoginPage: location.hash.includes('/login'),
  }
}), null, 2))
