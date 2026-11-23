// round-58: 鼠标点下拉 + 键盘方向键选择(未检验/已检验/全部)
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/prod/plan/workOrderProgress', { timeout: 60000 })
await page.waitForTimeout(9000)
const snap = () => page.evaluate(() => ({
  selects: [...document.querySelectorAll('.wpb-controls .el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  stats: (document.querySelector('.wpb-stats')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 55),
  rows: document.querySelectorAll('.wpb-grid-row').length,
}))
const openSel = async (idx) => {
  const p = await page.evaluate((idx) => {
    const s = [...document.querySelectorAll('.wpb-controls .el-select')][idx]
    const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, idx)
  await page.mouse.click(p.x, p.y, { label: 'open select ' + idx })
  await page.waitForTimeout(800)
}
const press = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(500) }
try {
  console.log('start:', JSON.stringify(await snap()))
  // QC select (index1) 当前 已检验 -> 上移选未检验
  await openSel(1); await press('ArrowUp'); await press('Enter'); await page.waitForTimeout(3500)
  console.log('after 未检验:', JSON.stringify(await snap()))
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-58-uninspected.png' })
  // 生产状态 index0 当前 未完工 -> 下移两次到全部
  await openSel(0); await press('ArrowDown'); await press('ArrowDown'); await press('Enter'); await page.waitForTimeout(3500)
  console.log('after status 全部:', JSON.stringify(await snap()))
  // QC select 当前 未检验 -> 下移选已检验
  await openSel(1); await press('ArrowDown'); await press('Enter'); await page.waitForTimeout(3500)
  console.log('after 已检验:', JSON.stringify(await snap()))
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-58-inspected.png' })
} finally {
  try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }) } catch (e) {}
}
