// 2026-11-12 round-05：装箱线能看到「等我的」工单（本线工序行）+ 可勾选打印
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// 找到「装箱2(新厂)」这条线并点击
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (!el) return 'not-found'
  el.click()
  return 'ok'
})
await page.waitForTimeout(5000)
const info = await page.evaluate(() => ({
  line: (document.querySelector('.wb-ctx-label') || {}).textContent || '',
  rows: [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  tags: [...document.querySelectorAll('.wb-tag-line')].map((t) => (t.textContent || '').trim()),
  summary: (document.querySelector('.wb-ctx-stats') || {}).textContent || '',
  headers: [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).filter((h) => /工序|可加工|待报|待流入|上道/.test(h)),
}))
console.log('clicked=' + clicked)
console.log(JSON.stringify(info, null, 2))

// 勾选第一行 → 打印按钮应可用
await page.evaluate(() => {
  const box = document.querySelector('.wb-main .el-table__body tr.el-table__row .el-checkbox')
  if (box) box.click()
})
await page.waitForTimeout(1200)
const btns = await page.evaluate(() => [...document.querySelectorAll('.wb-actions button')].map((b) => ({ t: (b.textContent || '').trim(), dis: !!b.disabled })))
console.log('buttons=' + JSON.stringify(btns))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-05-packline.png' })
