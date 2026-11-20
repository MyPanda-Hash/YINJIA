const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(3500)
const read = () => page.evaluate(() => ({
  box: document.querySelector('.wb-unf')?.innerText.replace(/\s+/g, ' ').trim(),
  ctx: document.querySelector('.wb-ctx b')?.textContent,
  picks: [...document.querySelectorAll('.wb-line')].filter((e) => e.querySelector('.el-checkbox.is-checked')).map((e) => (e.querySelector('.wb-line-name')?.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('initial', JSON.stringify(await read()))
// 选 1号车间
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('1号车间'))
  if (el) el.click()
})
await page.waitForTimeout(2500)
console.log('line1', JSON.stringify(await read()))
// 勾 1号车间
await page.click('.wb-line >> nth=0 .el-checkbox', { label: 'check workshop 1' }).catch((e) => console.log('cb1', e.message))
await page.waitForTimeout(500)
console.log('checked1', JSON.stringify(await read()))
// 勾 3号车间
const idx3 = await page.evaluate(() => [...document.querySelectorAll('.wb-line')].findIndex((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith('3号车间')))
console.log('idx3', idx3)
if (idx3 >= 0) await page.click(`.wb-line >> nth=${idx3} .el-checkbox`, { label: 'check workshop 3' }).catch((e) => console.log('cb3', e.message))
await page.waitForTimeout(500)
console.log('checked13', JSON.stringify(await read()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-plan-board-20261119/board-lines-box.png' })
