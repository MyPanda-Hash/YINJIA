// round-06:窗口状态诊断 + 点「打印」主按钮 → 弹窗
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
let winInfo = null
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  winInfo = w
  console.log('windowId=' + w.windowId)
  console.log('bounds=' + JSON.stringify(w.bounds || null))
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'maximized' } })
  const after = await task.cdp('Browser.getWindowBounds', { windowId: w.windowId })
  console.log('after=' + JSON.stringify(after))
} catch (e) { console.log('window: ' + e.message) }
await page.waitForTimeout(1200)

try {
  await page.click('css=.tb-group .tb-main:has-text("打印")', { label: 'open purchase order print' })
  console.log('clicked print main')
} catch (e) {
  console.log('real click failed: ' + e.message)
  const r = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').includes('打印'))
    if (!el) return 'no print main'
    el.scrollIntoView({ block: 'center' })
    el.click()
    return 'clicked via evaluate'
  })
  console.log(r)
}
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, tail: txt(document.body).slice(-400) }
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    bar: txt(root.querySelector('.pup-bar')),
    tip: txt(root.querySelector('.pup-tip')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    rowCount: rows.length,
    firstRows: rows.slice(0, 3).map(txt),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].slice(0, 6).map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
  }
})
console.log(JSON.stringify(dlg, null, 2))
try {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-06-dialog.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
