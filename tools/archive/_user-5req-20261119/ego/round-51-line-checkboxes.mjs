const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
const read = () => page.evaluate(() => ({
  box: document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim(),
  ctx: document.querySelector('.wb-ctx b')?.textContent,
  checked: [...document.querySelectorAll('.wb-line')].filter((e) => e.querySelector('.el-checkbox.is-checked')).map((e) => (e.querySelector('.wb-line-name')?.textContent || '').replace(/\s+/g, ' ').trim()),
}))
const clickCheck = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  const input = row?.querySelector('.el-checkbox input')
  if (input) input.click()
  return !!input
}, name)
console.log('before', JSON.stringify(await read()))
console.log('click1', await clickCheck('1号车间'))
await page.waitForTimeout(500)
console.log('after1', JSON.stringify(await read()))
console.log('click3', await clickCheck('3号车间'))
await page.waitForTimeout(500)
console.log('after13', JSON.stringify(await read()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-lines-box.png' })
console.log('select 3', await page.evaluate(() => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('3号车间'))
  if (row) row.click()
  return !!row
}))
await page.waitForTimeout(2200)
console.log('afterSelect3', JSON.stringify(await read()))
