const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('css:.el-dialog .el-button--primary')
await page.waitForTimeout(3500)
const res = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  if (!dlg) return { err: 'no dialog' }
  const rows = [...dlg.querySelectorAll('tbody tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    rowCount: rows.length,
    rows: rows.slice(0, 8),
    empty: (dlg.textContent || '').includes('暂无数据'),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-33-query-result.png' })
