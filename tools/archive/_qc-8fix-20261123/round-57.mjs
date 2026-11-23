// round-57: 鼠标下拉复测(含状态=全部 + 已检验)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const snap = () => page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  rows: document.querySelectorAll('.wpb-grid-row').length,
}))
const pick = async (idx, option) => {
  const sel = await page.evaluate((idx) => {
    const s = [...document.querySelectorAll('.wpb-controls .el-select')][idx]
    const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, idx)
  await page.mouse.click(sel.x, sel.y, { label: 'open select' })
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null).map((x) => {
    const r = x.getBoundingClientRect(); return { t: (x.innerText || '').trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }))
  console.log('visible opts:', JSON.stringify(opts))
  const o = opts.find((x) => x.t === option)
  if (o) await page.mouse.click(o.x, o.y, { label: 'pick ' + option })
  await page.waitForTimeout(4000)
}
try {
  console.log('start:', JSON.stringify(await snap()))
  await pick(1, '未检验')
  console.log('after 未检验:', JSON.stringify(await snap()))
  await pick(0, '全部')
  console.log('after status 全部:', JSON.stringify(await snap()))
  await pick(1, '已检验')
  console.log('after 已检验:', JSON.stringify(await snap()))
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-57-board-mouse.png' })
} finally {
  try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }) } catch (e) {}
}
