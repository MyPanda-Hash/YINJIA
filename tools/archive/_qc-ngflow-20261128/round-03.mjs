const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2500)

// 点「YINJIA-MES」那颗工厂切换器(按 aria-label 精确定位,避开「切换语言」那颗同 class)
await page.click('span[aria-label="YINJIA-MES"]', { label: '打开登录工厂切换' })
await page.waitForTimeout(1800)
const opts = await page.evaluate(() => ({
  menus: [...document.querySelectorAll('.el-dropdown-menu__item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  visibleText: document.body.innerText.slice(0, 500),
}))
console.log('FACTORY-OPTIONS', JSON.stringify(opts, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-03-factory.png' })
