const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 用侧栏「查询单据」这条正规路径打开一张单
await page.click('text=查询单据')
await page.waitForTimeout(2000)
let d = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return dlg ? {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    text: (dlg.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    buttons: [...dlg.querySelectorAll('button, .el-button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10),
  } : null
})
console.log('dialog1=' + JSON.stringify(d))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-25-query.png' })
