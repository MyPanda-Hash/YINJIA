// round-22:用真实 mouse 点击(.el-select__wrapper)打开下拉,短延时后取证
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(1500)
const box = await page.evaluate(() => {
  const w = document.querySelector('table.rs-dt td.rs-td .el-select .el-select__wrapper')
  if (!w) return null
  const r = w.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('box:', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(900)
}
console.log(JSON.stringify(await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  return {
    count: items.length,
    texts: items.map((e) => (e.textContent || '').trim()),
    popper: [...document.querySelectorAll('.el-popper')].filter((p) => p.getBoundingClientRect().height > 0).map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)),
    focused: (document.activeElement && document.activeElement.className) || '',
  }
}), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-22.png' })
