// round-27:截「检查频率」下拉(seq 顺序)的图;单独一次跑,避免状态漂移
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
const box = await page.evaluate(() => {
  const w = document.querySelector('table.rs-dt td.rs-td .el-select .el-select__wrapper')
  if (!w) return null
  const r = w.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('box:', JSON.stringify(box))
if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(1000) }
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-27-dropdown-seq.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  options: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
})), null, 2))
