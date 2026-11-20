const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('span.show-name')].find((e) => e.offsetParent)
  if (el) el.click()
})
await page.waitForTimeout(1000)
const menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')].map((e) => (e.innerText || '').trim()))
console.log('MENU', JSON.stringify(menu))
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')]
  const t = items.find((e) => (e.innerText || '').trim() === '退出')
  if (t) t.click()
})
await page.waitForTimeout(3000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s7-after-logout.png' })
