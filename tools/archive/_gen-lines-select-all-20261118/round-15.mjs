const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gl-dialog button')].find((x) => (x.textContent || '').trim() === '取消')
  b?.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.dsr-picked button')].find((x) => (x.textContent || '').includes('清空'))
  b?.click()
})
await page.waitForTimeout(500)
console.log(JSON.stringify(await page.evaluate(() => ({
  dlgOpen: !!document.querySelector('.gl-dialog')?.offsetParent,
  rail: (document.querySelector('.dsr-picked')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))))
