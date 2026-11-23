// round-59: 鼠标开下拉 + ArrowDown 选未检验(当前=全部检验,状态=全部)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const p = await page.evaluate(() => {
  const s = [...document.querySelectorAll('.wpb-controls .el-select')][1]
  const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(p.x, p.y, { label: 'open QC select' })
await page.waitForTimeout(800)
await page.keyboard.press('ArrowDown')
await page.waitForTimeout(500)
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
console.log(JSON.stringify(await page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  rows: document.querySelectorAll('.wpb-grid-row').length,
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-59-uninspected.png' })
