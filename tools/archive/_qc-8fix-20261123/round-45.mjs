// round-45: 鼠标点新批次格输入(滚动后) + 下拉判定 + 截图
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
// 当前页面已滚动到 left=400, 新批次格 ci5 在 (899.95,305.4)
await page.mouse.click(899.95, 305.4, { label: 'click new batch result cell' })
await page.waitForTimeout(400)
await page.keyboard.insertText('鼠标录入-新批次-项目1')
await page.waitForTimeout(700)
// 点新批次格的判定下拉 ci6, 选「合格」
await page.mouse.click(995.15, 314.4, { label: 'open batch result select' })
await page.waitForTimeout(800)
const opt = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => (x.innerText || '').trim() === '合格')
  const el = items[items.length - 1]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('option 合格:', JSON.stringify(opt))
if (opt) await page.mouse.click(opt.x, opt.y, { label: 'pick 合格' })
await page.waitForTimeout(900)
console.log(JSON.stringify(await page.evaluate(() => {
  const tr = document.querySelector('.qr-grid tbody tr')
  return {
    tas: [...tr.querySelectorAll('textarea')].map((t) => t.value),
    selects: [...tr.querySelectorAll('.el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
    batchNames: [...document.querySelectorAll('.qr-batch-input input')].map((i) => i.value),
    scrollLeft: document.querySelector('.qr-grid-scroll').scrollLeft,
  }
}), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-45-mouse-new-batch.png' })
