const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.evaluate(() => {
  const clear = document.querySelector('.wb-unf-clear')
  if (clear) clear.click()
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('2号车间'))
  if (row) row.click()
})
await page.waitForTimeout(2500)
console.log(await page.evaluate(() => document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-unf-line2-8090.png' })
