const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.fill('css:input[placeholder="请输入该账套的登录密码"]', '123456')
await page.waitForTimeout(300)
const btns = await page.evaluate(() => [...document.querySelectorAll('.el-dialog button')].filter((b) => b.offsetParent !== null).map((b) => (b.textContent || '').trim()))
console.log('dialog buttons: ' + JSON.stringify(btns))
await page.click('loc=role:button[name="切换并重新登录"]')
await page.waitForTimeout(4000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  topFactory: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).find((t) => t.startsWith('YINJIA')) || '',
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-07.png' })
