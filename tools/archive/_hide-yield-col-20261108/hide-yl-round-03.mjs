// hide-yl-round-03.mjs — 生产工序进度看板「列表」视图复核:表格里是否还有「余量」列
const fs = await import('node:fs/promises')
const OUT = 'D:/workspace/yinjia/.tmp/ego/hide-yl'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 40000 })
await page.waitForTimeout(7000)

// 切「列表」视图(按钮文字=列表)
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, .el-radio-button, label')]
  const b = btns.find((x) => (x.innerText || '').replace(/\s+/g, '') === '列表')
  if (!b) return 'no-btn'
  b.click()
  return 'clicked'
})
console.log('切列表: ' + clicked)
await page.waitForTimeout(3500)

const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return {
    tableHeads: heads.length,
    headsSample: heads.slice(0, 24),
    hasYlHead: heads.some((h) => h.includes('余量')),
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    bodyHasYl: /余量/.test(document.body.innerText || ''),
  }
})
console.log('列表视图: ' + JSON.stringify(info))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/R3-progress-board-list.png' })
console.log('saved R3-progress-board-list.png')
