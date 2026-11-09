const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 第 2 个 el-select = 登录工厂
await page.click('css:.el-select:text-is("YINJIA-MES")')
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
  .filter((d) => d.offsetParent !== null)
  .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
console.log('factories=' + JSON.stringify(opts))
const list = opts[0] || []
const idx = list.findIndex((t) => t.includes('测试库')) + 1
if (idx > 0) {
  await page.click(`css:.el-select-dropdown li:nth-child(${idx})`)
  await page.waitForTimeout(600)
}
await page.fill('css:input[placeholder="请输入登录账号"]', 'admin')
await page.fill('css:input[placeholder="请输入登录密码"]', '123456')
await page.waitForTimeout(300)
await page.click('loc=role:button[name="进入系统"]')
await page.waitForTimeout(7000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: JSON.parse(localStorage.getItem('mes_factory') || 'null'),
  bodyTop: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-46-logged-in.png' })
