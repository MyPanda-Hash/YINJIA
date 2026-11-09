const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('css:span.as-side-btn.primary')
await page.waitForTimeout(3500)
const res = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return {
    dialog: d ? { title: d.querySelector('.el-dialog__title')?.textContent?.trim(), text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500) } : null,
    rows: [...document.querySelectorAll('.el-dialog tbody tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-24-fuzzy-result.png' })
