const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 侧栏「查询单据」→ 弹窗里查询 → 勾/打开第一张(最近的 EU-2026-11-0003)
await page.click('css:.approval-side .as-side-btn:nth-of-type(1)')
await page.waitForTimeout(2500)
const d1 = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return dlg ? {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    text: (dlg.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    buttons: [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10),
  } : null
})
console.log('d1=' + JSON.stringify(d1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-29-query-dialog.png' })
