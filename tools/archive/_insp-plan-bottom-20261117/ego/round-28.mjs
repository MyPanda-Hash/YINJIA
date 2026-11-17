// round-28:用元素 click(不依赖坐标,避开右侧工具栏遮挡)打开下拉并截图
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
const r = await page.evaluate(() => {
  const td = [...document.querySelectorAll('table.rs-dt td.rs-td')].find((c) => c.querySelector('.el-select'))
  if (!td) return 'no td'
  const w = td.querySelector('.el-select__wrapper')
  w.click()
  return 'clicked'
})
console.log('click:', r)
await page.waitForTimeout(1200)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-28-dropdown.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  options: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
  popper: [...document.querySelectorAll('.el-popper')].filter((p) => p.getBoundingClientRect().height > 0).map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)),
})), null, 2))
