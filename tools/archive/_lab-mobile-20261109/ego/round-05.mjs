const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  if (!d) return { open: false }
  return {
    open: true,
    title: d.querySelector('.el-dialog__title')?.textContent?.trim(),
    text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
    items: [...d.querySelectorAll('.el-radio, .el-select__wrapper, li')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12),
  }
})
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-05.png' })
