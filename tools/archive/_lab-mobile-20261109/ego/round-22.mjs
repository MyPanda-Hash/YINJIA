const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.fill('css:input[placeholder="内容"]', 'EU-2026-11-0003')
await page.waitForTimeout(300)
await page.click('loc=role:button[name="查找"]')
await page.waitForTimeout(3000)
const list = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((e) => e.offsetParent !== null).pop()
  return {
    dialog: d ? { title: d.querySelector('.el-dialog__title')?.textContent?.trim(), text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) } : null,
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  }
})
console.log(JSON.stringify(list, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-22-fuzzy-result.png' })
