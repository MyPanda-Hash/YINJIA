// round-03:退出登录 → 用「YJ_TEST 测试库」重新登录(写操作只在测试库做)
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(4000)

// 1) 点右上角用户区打开下拉
const opened = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('header *, .el-dropdown')].filter((e) => (e.textContent || '').includes('系统管理员'))
  const el = cand[cand.length - 1]
  if (el) { el.click(); return true }
  return false
})
console.log('user menu clicked:', opened)
await page.waitForTimeout(1200)
const logoutClicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
  const out = items.find((e) => (e.textContent || '').includes('退出登录'))
  if (out) { out.click(); return true }
  return items.map((e) => (e.textContent || '').trim())
})
console.log('logout:', JSON.stringify(logoutClicked))
await page.waitForTimeout(3000)
console.log('hash after logout:', await page.evaluate(() => location.hash))
console.log(JSON.stringify(await page.evaluate(() => ({
  loginLabels: [...document.querySelectorAll('.el-form-item__label')].map((e) => e.textContent.trim()),
  placeholders: [...document.querySelectorAll('input')].map((i) => i.placeholder),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-03-login.png' })
