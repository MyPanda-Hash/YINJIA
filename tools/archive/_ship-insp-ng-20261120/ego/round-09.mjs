const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
// 打开「登录工厂」下拉
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select--large')][0]
  if (sel) sel.click()
})
await page.waitForTimeout(800)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.innerText || '').trim()))
console.log('OPTS', JSON.stringify(opts))
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const t = items.find((e) => (e.innerText || '').includes('测试库'))
  if (t) t.click()
})
await page.waitForTimeout(800)
const cur = await page.evaluate(() => (document.querySelector('.el-select--large')?.innerText || '').trim())
console.log('CUR', cur)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s9-factory.png' })
