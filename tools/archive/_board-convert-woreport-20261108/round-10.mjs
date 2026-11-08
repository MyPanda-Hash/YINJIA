// round-10.mjs — 终验截图:工单排产(2号车间)未滚动状态,冻结列在左、其余列在右
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
const picked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.wb-line')]
  const t = els.find((el) => (el.querySelector('.wb-line-name') || el).textContent.trim().startsWith('2号车间'))
  if (!t) return null
  t.click()
  return '2号车间'
})
console.log('picked=' + picked)
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('.wb-block .el-scrollbar__wrap')]
  const w = wraps.find((el) => el.scrollWidth > el.clientWidth + 10) || wraps[0]
  if (w) { w.scrollLeft = 0; w.dispatchEvent(new Event('scroll', { bubbles: true })) }
})
await page.waitForTimeout(1000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
// 只截表格区域,便于阅读
const box = await page.evaluate(() => {
  const el = document.querySelector('.wb-block')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.max(0, r.x - 2), y: Math.max(0, r.y - 2), width: r.width + 4, height: Math.min(r.height, 420) }
})
if (box) await page.screenshot({ path: OUT + '/round-10-board-final.png', clip: box })
else await page.screenshot({ path: OUT + '/round-10-board-final.png' })
console.log('saved round-10-board-final.png box=' + JSON.stringify(box))
