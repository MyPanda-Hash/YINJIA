// round-05: 先在轻量页面验证截图能力本身是否可用,再回采购订单。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)
try {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-05-login.png' })
  console.log('SHOT_LOGIN OK')
} catch (e) { console.log('shot login err ' + e.message) }
