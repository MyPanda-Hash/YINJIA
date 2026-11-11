// round-03:退出当前会话 → 打开登录页 → dump 表单,准备用 YJ_TEST(测试库)登录
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.evaluate(() => {
  for (const k of ['mes_token', 'mes_user', 'mes_factory', 'mes_login_date']) localStorage.removeItem(k)
})
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 800),
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, val: i.value, type: i.type, cls: i.className })),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
}))
console.log(JSON.stringify(info, null, 2))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-03-login.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
