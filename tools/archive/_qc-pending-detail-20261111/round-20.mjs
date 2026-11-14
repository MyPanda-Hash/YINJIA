/* round-20.mjs — 只看列头顺序 + 截图 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

const th = await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__header th')]
    .map((el) => (el.innerText || '').replace(/[\s⇅]+/g, ' ').trim())
    .filter(Boolean))
console.log('表头顺序 ->', JSON.stringify(th))
console.log('行号列出现次数 ->', th.filter((t) => t.includes('行号')).length, th.filter((t) => t.includes('行号')))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip ' + e.message) }
const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-20-cols.png' })
console.log('shot=' + p)
