// round-29:一次跑完:新文档 → 加行 → 元素 click 打开下拉 → 截图 + 选项
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(1800)
console.log('click:', await page.evaluate(() => {
  const td = [...document.querySelectorAll('table.rs-dt td.rs-td')].find((c) => c.querySelector('.el-select'))
  if (!td) return 'no td'
  td.querySelector('.el-select__wrapper').click()
  return 'clicked'
}))
await page.waitForTimeout(1200)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-29-dropdown.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  options: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
})), null, 2))
