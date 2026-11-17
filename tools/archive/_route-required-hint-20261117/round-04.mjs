const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 先只读:看当前单据的表头值 + 明细行里哪些必填格是空的
console.log(JSON.stringify(await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.fields .field')].map((f) => ({
    label: (f.querySelector('label')?.textContent || '').trim(),
    code: f.dataset.code,
    value: f.querySelector('input')?.value ?? '',
  }))
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim())
    return { missingRowCls: tr.className, first: cells.slice(0, 6) }
  })
  return { inputs, rows: rows.slice(0, 6) }
}), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-04-before.png' })
