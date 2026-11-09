const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
const btns = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  if (!dlg) return { err: 'no dialog' }
  return {
    title: dlg.querySelector('.el-dialog__title')?.textContent?.trim(),
    buttons: [...dlg.querySelectorAll('button')].map((b, i) => ({ i, cls: b.className, txt: (b.textContent || '').trim() })),
  }
})
console.log(JSON.stringify(btns, null, 2))
