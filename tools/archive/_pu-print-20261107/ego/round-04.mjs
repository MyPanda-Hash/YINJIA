// round-04:选中左栏第一张采购订单 → 看工具栏 → 打开"打印"下拉,确认入口
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }
try { await page.cdp('Page.bringToFront', {}) } catch (e) { console.log('front: ' + e.message) }
await page.waitForTimeout(800)

// 选第一张单(左栏第一行)
const firstRow = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')]
  return rows.length ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim() : ''
})
console.log('firstRow=' + firstRow)
await page.click('tbody tr >> nth=0', { label: 'select first purchase order' })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const groups = [...document.querySelectorAll('.toolbar-group, .tb-group, .px-group, .toolbar .el-dropdown, .toolbar button')]
    .map((el) => ({ cls: el.className, text: txt(el) }))
  return {
    hash: location.hash,
    docTitle: txt(document.querySelector('.doc-rail-head, .rail-head, .doc-head')),
    toolbar: groups.slice(0, 40),
    buttons: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 40),
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-04-selected.png', timeout: 20000 })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
