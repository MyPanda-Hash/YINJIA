// round-04:在用户菜单里切「YINJIA-MES·测试库」,确认令牌里的 factory,并打开面板
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(4000)
// 打开用户下拉
await page.evaluate(() => {
  const cand = [...document.querySelectorAll('header *, .el-dropdown')].filter((e) => (e.textContent || '').includes('系统管理员'))
  const el = cand[cand.length - 1]
  if (el) el.click()
})
await page.waitForTimeout(1200)
const switched = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]
  const t = items.find((e) => (e.textContent || '').includes('测试库'))
  if (t) { t.click(); return true }
  return false
})
console.log('switch to test factory clicked:', switched)
await page.waitForTimeout(5000)
// 令牌里看 factory 声明
console.log(JSON.stringify(await page.evaluate(() => {
  const keys = Object.keys(localStorage)
  const tokKey = keys.find((k) => /token/i.test(k))
  let claims = null
  try {
    const t = tokKey ? localStorage.getItem(tokKey) : ''
    const raw = (t || '').replace(/^"|"$/g, '')
    const payload = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    claims = { factory: payload.factory, user: payload.sub || payload.username, exp: payload.exp }
  } catch (e) { claims = 'decode fail: ' + e.message }
  return { tokenKeys: keys.filter((k) => /token|factory|user/i.test(k)), claims, hash: location.hash }
}), null, 2))
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => ({
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-04.png' })
