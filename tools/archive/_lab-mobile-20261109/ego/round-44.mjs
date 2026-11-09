const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 退出登录 → 用「登录工厂 = 测试库」重新登录(切库要换令牌,靠对话框那条路不稳)
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', type: i.type })),
  selectTexts: [...document.querySelectorAll('.el-select, .factory-select, [class*=factory]')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-44-login.png' })
