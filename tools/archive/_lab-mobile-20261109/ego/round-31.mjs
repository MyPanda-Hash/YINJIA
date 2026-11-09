const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 查询单据弹窗 → 查询 → 结果里打开第一行
await page.click('css:.el-dialog button:text-is("查询")')
await page.waitForTimeout(3000)
const res = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return dlg ? {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    rows: [...dlg.querySelectorAll('tbody tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
    buttons: [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10),
  } : null
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-31-query-result.png' })
