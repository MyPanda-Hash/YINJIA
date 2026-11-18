const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')

// 取消勾选第 2 行
await page.click('.el-dialog .el-table__body-wrapper tr.el-table__row:nth-child(2) .el-checkbox', { label: 'uncheck row 2' })
await page.waitForTimeout(800)
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
    const qty = tr.querySelector('.el-input-number input')
    const selects = [...tr.querySelectorAll('.el-select')]
    return {
      checked: !!tr.querySelector('.el-checkbox.is-checked'),
      cls: tr.className,
      bg: getComputedStyle(td).backgroundColor,
      color: getComputedStyle(tr.querySelector('td .cell')).color,
      qtyDisabled: qty?.disabled,
      qtyVal: qty?.value,
      whDisabled: selects[0] ? !!selects[0].querySelector('input')?.disabled : null,
      binDisabled: selects[1] ? !!selects[1].querySelector('input')?.disabled : null,
    }
  })
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pickrow-eval-20261117/v1-batchsend-unchecked.png' })
console.log('shot=v1-batchsend-unchecked.png')
