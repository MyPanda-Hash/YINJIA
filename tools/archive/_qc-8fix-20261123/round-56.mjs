// round-56: 真鼠标: 看板「检验状态」下拉 → 未检验 / 已检验
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/prod/plan/workOrderProgress', { timeout: 60000 })
await page.waitForTimeout(9000)
const snap = () => page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  rows: document.querySelectorAll('.wpb-grid-row').length,
}))
const pick = async (which, option) => {
  const sel = await page.evaluate((which) => {
    const s = [...document.querySelectorAll('.wpb-controls .el-select')][which]
    const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, which)
  await page.mouse.click(sel.x, sel.y, { label: 'open select ' + option })
  await page.waitForTimeout(700)
  const opt = await page.evaluate((option) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => (x.innerText || '').trim() === option && x.offsetParent !== null)
    const el = items[items.length - 1]
    if (!el) return null
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, option)
  console.log('option', option, ':', JSON.stringify(opt))
  if (opt) await page.mouse.click(opt.x, opt.y, { label: 'pick ' + option })
  await page.waitForTimeout(4000)
}
console.log('initial:', JSON.stringify(await snap()))
await pick(1, '未检验')
console.log('after 未检验:', JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-56-board-uninspected.png' })
await pick(1, '已检验')
console.log('after 已检验:', JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-56-board-inspected.png' })
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
