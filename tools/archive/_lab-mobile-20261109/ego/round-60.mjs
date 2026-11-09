const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 会话在正式库(YJ)。切到测试库:清会话 → 登录页选「测试库」
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
const fact = await page.evaluate(() => JSON.parse(localStorage.getItem('mes_factory') || 'null'))
console.log('factory=' + JSON.stringify(fact))
if (!fact || fact.code !== 'YJ_TEST') {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(4000)
  await page.click('css:.el-select >> nth=1')
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
    .filter((d) => d.offsetParent !== null)
    .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
  const idx = (opts[0] || []).findIndex((t) => t.includes('测试库')) + 1
  if (idx > 0) { await page.click(`css:.el-select-dropdown li:nth-child(${idx})`); await page.waitForTimeout(600) }
  await page.fill('css:input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('css:input[placeholder="请输入登录密码"]', '123456')
  await page.click('loc=role:button[name="进入系统"]')
  await page.waitForTimeout(7000)
}
const st = await page.evaluate(() => ({ hash: location.hash, factory: JSON.parse(localStorage.getItem('mes_factory') || 'null') }))
console.log('now=' + JSON.stringify(st))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-60-login.png' })
