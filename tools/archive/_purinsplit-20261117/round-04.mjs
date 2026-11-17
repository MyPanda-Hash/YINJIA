const task = await taskSpace('purin-multiwh-20261117')
const page = task.page('p1')

const opened = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const btn = [...document.querySelectorAll('.tools .tb-main')].filter(vis).find((b) => (b.textContent || '').trim() === '多仓库入库')
  if (!btn) return 'no-button'
  btn.click()
  await sleep(2600)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return 'no-dialog'
  const rows = [...dlg.querySelectorAll('.el-table__body-wrapper tr')].filter(vis)
  return {
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rowCount: rows.length,
    rows: rows.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)),
  }
})
console.log(JSON.stringify(opened, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-multiwh-20261117/m2-dialog.png' })
