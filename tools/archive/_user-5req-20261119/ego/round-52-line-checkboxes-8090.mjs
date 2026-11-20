const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(4000)
const read = () => page.evaluate(() => ({
  box: document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim(),
  ctx: document.querySelector('.wb-ctx b')?.textContent,
  checked: [...document.querySelectorAll('.wb-line')].filter((e) => e.querySelector('.el-checkbox.is-checked')).length,
  pickCount: document.querySelectorAll('.wb-line .wb-line-pick').length,
}))
console.log('initial', JSON.stringify(await read()))
const clickCheck = (name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(name))
  const input = row?.querySelector('.el-checkbox input')
  if (input) input.click()
  return !!input
}, name)
const firstLine = await page.evaluate(() => (document.querySelector('.wb-line .wb-line-name')?.textContent || '').replace(/\s+/g, ' ').trim())
console.log('first', firstLine)
await page.evaluate(() => document.querySelector('.wb-line')?.click())
await page.waitForTimeout(2500)
console.log('afterSelect', JSON.stringify(await read()))
await clickCheck('1号车间')
await page.waitForTimeout(400)
console.log('afterCheck1', JSON.stringify(await read()))
const names = await page.evaluate(() => [...document.querySelectorAll('.wb-line .wb-line-name')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
const third = names.find((n) => n.startsWith('3号车间'))
if (third) await clickCheck('3号车间')
await page.waitForTimeout(400)
console.log('afterCheck13', JSON.stringify(await read()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-lines-box-8090.png' })
