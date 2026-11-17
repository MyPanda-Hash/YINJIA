const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')

await page.click('.el-dialog .el-table__body-wrapper tr.el-table__row:nth-child(2) .el-checkbox', { label: 'uncheck row 2' })
await page.waitForTimeout(900)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const rows = [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
  return rows.map((tr) => {
    const td = tr.querySelector('td.el-table__cell')
    const inputs = [...tr.querySelectorAll('.el-input-number input')]
    return {
      checked: !!tr.querySelector('.el-checkbox.is-checked'),
      cls: tr.className,
      bg: getComputedStyle(td).backgroundColor,
      color: getComputedStyle(tr.querySelector('td .cell')).color,
      qtyDisabled: inputs[0]?.disabled,
      boxDisabled: inputs[1]?.disabled,
      qtyVal: inputs[0]?.value,
    }
  })
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pickrow-eval-20261117/v10-materiallabel-unchecked.png' })
console.log('shot=v10-materiallabel-unchecked.png')
