// round-09.mjs — 菜单浮层核对:鼠标移到「来料品质」→ 浮层里应出现「品质流程监控」且排第一
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.evaluate(() => { location.hash = '#/qc/flowMonitor' })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

const box = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const el = [...document.querySelectorAll('.nav-module')].find((n) => text(n) === '来料品质')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('nav-module box =', JSON.stringify(box))
if (box) {
  await page.mouse.move(box.x, box.y, { label: '悬停来料品质' })
  await page.waitForTimeout(1600)
}
const card = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    items: [...document.querySelectorAll('.card-item')].map((i) => ({ text: text(i), depth: i.style.getPropertyValue('--card-depth') })),
    hasFlow: [...document.querySelectorAll('.card-item')].some((i) => text(i).includes('品质流程监控')),
  }
})
console.log('card =', JSON.stringify(card, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-09-menu-card.png' })

// 点浮层里的「品质流程监控」
const clicked = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const item = [...document.querySelectorAll('.card-item')].find((i) => text(i).includes('品质流程监控'))
  if (item) item.click()
  return !!item
})
await page.waitForTimeout(2500)
console.log('clicked=', clicked, 'hash=', await page.evaluate(() => location.hash))
