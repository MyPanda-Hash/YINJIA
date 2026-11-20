const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(3500)
const read = () => page.evaluate(() => ({
  box: document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim(),
  ctx: document.querySelector('.wb-ctx b')?.textContent,
  checked: [...document.querySelectorAll('.wb-line')].filter((e) => e.querySelector('.el-checkbox.is-checked')).map((e) => (e.querySelector('.wb-line-name')?.textContent || '').replace(/\s+/g, ' ').trim()),
}))
const selectLine = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  if (row) row.click()
  return !!row
}, name)
const clickCheck = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  const input = row?.querySelector('.el-checkbox input')
  if (input) input.click()
  return !!input
}, name)
await selectLine('2号车间')
await page.waitForTimeout(2500)
console.log('line2', JSON.stringify(await read()))
await clickCheck('1号车间')
await clickCheck('3号车间')
await page.waitForTimeout(600)
console.log('checked1+3', JSON.stringify(await read()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-unf-process.png' })
