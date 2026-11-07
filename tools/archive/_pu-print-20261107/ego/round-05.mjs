// round-05:点工具栏「打印」(主按钮=打印采购订单) → 弹窗应出现(勾选+填数量)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }

const printGroupHtml = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => (el.textContent || '').includes('打印'))
  return g ? g.outerHTML.slice(0, 1200) : '(no print group)'
})
console.log('printGroup=' + printGroupHtml)

await page.click('css=.tb-group:has-text("打印")', { label: 'open purchase order print' })
await page.waitForTimeout(2500)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, bodyTail: txt(document.body).slice(-300) }
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
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-05-dialog.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
