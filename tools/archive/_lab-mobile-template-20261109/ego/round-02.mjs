// 展开第 1 行,看模版分格小标题与字段(证据截图)
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

// 页面已在「除汞」状态(上一轮留下的登录态 + 路由),刷新一次保持
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 40000 })
await page.waitForTimeout(6000)
const tpl = await page.evaluate(() => ({ hint: (document.querySelector('.labm-tpl')?.textContent || '').trim() }))
console.log('hint=' + JSON.stringify(tpl))
await page.click('css:.labm-drow-head >> nth=0')
await page.waitForTimeout(1200)
const s = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('.labm-drow-body .labm-grp')].map((e) => (e.textContent || '').trim()),
  labels: [...document.querySelectorAll('.labm-drow-body .labm-field > label')].map((e) => (e.textContent || '').trim()),
}))
console.log('groups=' + JSON.stringify(s.groups))
console.log('labels=' + JSON.stringify(s.labels))
await page.screenshot({ path: `${OUT}/05-除汞-展开.png`, fullPage: true })
