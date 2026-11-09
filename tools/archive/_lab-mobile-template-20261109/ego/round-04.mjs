// 展开行看分格小标题(证据截图)
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }
const open = await page.evaluate(() => {
  const body = document.querySelector('.labm-drow-body')
  return !!(body && body.offsetParent !== null)
})
if (!open) { await page.click('css:.labm-drow-head >> nth=0'); await page.waitForTimeout(1200) }
const s = await page.evaluate(() => ({
  open: !!(document.querySelector('.labm-drow-body')?.offsetParent),
  groups: [...document.querySelectorAll('.labm-drow-body .labm-grp')].map((e) => e.textContent.trim()),
  n: document.querySelectorAll('.labm-drow-body .labm-field').length,
}))
console.log(JSON.stringify(s))
// 让模版段落完整可见:滚到明细区
await page.evaluate(() => { document.querySelector('.labm-sec2')?.scrollIntoView({ block: 'start' }) })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/06-除汞-展开.png` })
