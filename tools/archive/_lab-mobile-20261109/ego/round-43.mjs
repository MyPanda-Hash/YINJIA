const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(2000)
const cur = await page.evaluate(() => JSON.parse(localStorage.getItem('mes_factory') || 'null'))
console.log('now=' + JSON.stringify(cur))

if (!cur || cur.code !== 'YJ_TEST') {
  await page.click('loc=role:button[name="YINJIA-MES"]')
  await page.waitForTimeout(900)
  await page.click('text=YINJIA-MES·测试库')
  await page.waitForTimeout(900)
  await page.click('text=切换并重新登录')
  await page.waitForTimeout(900)
  await page.fill('css:input[placeholder="请输入该账套的登录密码"]', '123456')
  await page.waitForTimeout(300)
  await page.click('loc=role:button[name="切换并重新登录"]')
  await page.waitForTimeout(6000)
}
const after = await page.evaluate(() => ({ factory: JSON.parse(localStorage.getItem('mes_factory') || 'null'), hash: location.hash }))
console.log('after=' + JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-43-switch.png' })
