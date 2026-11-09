// 选「NSF 53-除汞（PH8.5）」→ 展开第 1 行 → 截图(证据:模版分格 + 字段)
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 40000 })
await page.waitForTimeout(7000)
await page.click('css:.labm-field .el-select >> nth=0')
await page.waitForTimeout(1200)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
const i = opts.findIndex((t) => t.includes('除汞'))
console.log('opts=' + JSON.stringify(opts) + ' idx=' + i)
await page.click(`css:.el-select-dropdown__item >> nth=${i}`)
await page.waitForTimeout(2200)
// 展开第 1 行
try { await page.click('css:.labm-drow-head >> nth=0', { timeout: 4000 }) } catch (e) { console.log('row toggle skip') }
await page.waitForTimeout(1000)
const s = await page.evaluate(() => ({
  hint: (document.querySelector('.labm-tpl')?.textContent || '').replace(/\s+/g, ' ').trim(),
  groups: [...document.querySelectorAll('.labm-drow-body .labm-grp')].map((e) => (e.textContent || '').trim()),
  labels: [...document.querySelectorAll('.labm-drow-body .labm-field > label')].map((e) => (e.textContent || '').trim()),
}))
console.log('hint=' + JSON.stringify(s.hint))
console.log('groups=' + JSON.stringify(s.groups))
console.log('labels=' + JSON.stringify(s.labels))
await page.screenshot({ path: `${OUT}/05-除汞-展开.png` })
