const task = await taskSpace('purin-multiwh-20261117')
const page = task.page('p1')

await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-multiwh-20261117/m4-filled.png' })
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  ok?.click()
})
await page.waitForTimeout(8000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const after = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  const heads = [...document.querySelectorAll('.detail .el-table__header-wrapper th')].map((th) => (th.textContent || '').trim())
  const whIdx = heads.indexOf('仓库')
  return {
    msg: [...document.querySelectorAll('.el-message')].filter(vis).map((m) => (m.textContent || '').trim()),
    rowCount: rows.length,
    rows: rows.map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      return {
        code: (tds[1]?.textContent || '').trim(),
        qty: (tds[4]?.textContent || '').trim(),
        wh: (tds[whIdx]?.textContent || '').trim(),
      }
    }),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-multiwh-20261117/m5-after.png' })
