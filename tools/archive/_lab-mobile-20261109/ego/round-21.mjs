const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('text=模糊搜索')
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return d ? {
    title: d.querySelector('.el-dialog__title')?.textContent?.trim(),
    text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    inputs: [...d.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', v: i.value })),
    buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
  } : null
})
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-21-fuzzy.png' })
