const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/panelx/list/RD_PROD_DOCLIST?flow=1', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const st = await page.evaluate(() => ({
  hash: location.hash,
  toggle: [...document.querySelectorAll('.pds-view-toggle')].map((e) => (e.textContent || '').trim()),
  rows: document.querySelectorAll('.pds-flow-row').length,
  empties: [...document.querySelectorAll('.pds-flow-empty')].map((e) => (e.textContent || '').trim()),
  first: [...document.querySelectorAll('.pds-flow-main')].slice(0, 3).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)),
}))
console.log(JSON.stringify(st, null, 1))
// 展开第一行看五步
const exp = await page.evaluate(() => {
  const m = document.querySelector('.pds-flow-main')
  if (!m) return 'NO_ROW'
  m.click()
  return 'CLICKED'
})
console.log('展开 =', exp)
await page.waitForTimeout(1200)
const steps = await page.evaluate(() => [...document.querySelectorAll('.pds-flow-steps:first-of-type .pds-flow-step')].slice(0, 6).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('五步 =', JSON.stringify(steps, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-flow-overview.png' })
console.log('shot =', shot)
