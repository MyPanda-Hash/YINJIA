const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('text=切换并重新登录')
await page.waitForTimeout(1200)
const st = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return {
    hash: location.hash,
    dialog: d ? { title: d.querySelector('.el-dialog__title')?.textContent?.trim(), text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) } : null,
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', type: i.type, val: i.value })),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 20),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-06.png' })
