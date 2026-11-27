const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2500)

// 打开登录工厂切换器,看有哪些选项
await page.click('.factory', { label: '切换登录工厂' })
await page.waitForTimeout(1500)
const opts = await page.evaluate(() => ({
  items: [...document.querySelectorAll('.el-dropdown-menu__item, .el-menu-item, li')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length < 40).slice(0, 20),
}))
console.log('FACTORY-OPTIONS', JSON.stringify(opts, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-02-factory.png' })
