// round-15:强制新文档加载(about:blank → 目标页),再验证频率下拉
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log(JSON.stringify(await page.evaluate(() => ({
  apiCalls: performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('/api/')).map((n) => n.replace('http://localhost:5173', '')).slice(0, 40),
})), null, 2))
// 关掉可能的弹窗
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(800)
// 加一行
const rowsBefore = await page.evaluate(() => [...document.querySelectorAll('table.rs-dt tbody td.rs-td')].length)
console.log('detail cells before add:', rowsBefore)
await page.evaluate(() => {
  const add = [...document.querySelectorAll('.rs-add')][0]
  if (add) add.click()
})
await page.waitForTimeout(1500)
const box = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('table.rs-dt tbody tr')].find((r) => r.querySelector('td.rs-td .el-select'))
  if (!tr) return null
  const td = [...tr.querySelectorAll('td.rs-td')].find((c) => c.querySelector('.el-select'))
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('cell box:', JSON.stringify(box))
if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(1500) }
console.log(JSON.stringify(await page.evaluate(() => ({
  visibleOptions: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
})), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-15.png' })
