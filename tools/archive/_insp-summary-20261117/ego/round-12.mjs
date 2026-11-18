// round-12:快捷区间(今天/本周/本月/上月)区间值与取数联动
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
const read = async () => page.evaluate(() => ({
  quick: [...document.querySelectorAll('.el-radio-button')].filter((n) => n.className.includes('is-active')).map((n) => (n.textContent || '').trim())[0],
  range: [...document.querySelectorAll('.iss-range input')].map((i) => i.value),
  stats: [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()),
}))
const click = async (label) => {
  await page.evaluate((t) => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes(t))?.click(), label)
  await page.waitForTimeout(2200)
  return read()
}
const out = {}
out.week = await read()
out.today = await click('今天')
out.month = await click('本月')
out.lastMonth = await click('上月')
out.backWeek = await click('本周')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/13-5173-quick-ranges.png` })
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
