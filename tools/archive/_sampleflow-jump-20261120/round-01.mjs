// round-01 — 生产环境登录 + 打开样品进度跟踪（取证基线）
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 90000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 90000 })
await page.waitForTimeout(3000)
const before = await page.evaluate(() => ({
  url: location.href,
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
  hasForm: !!document.querySelector('.login-form'),
}))
console.log('LOGIN-PAGE ' + JSON.stringify(before, null, 2))

await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
console.log('factory select text: ' + sel)
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(500)
  const first = await page.evaluate(() => {
    const it = document.querySelector('.el-select-dropdown__item')
    return it ? it.innerText.trim() : ''
  })
  console.log('first factory option: ' + first)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(300)
}
await page.click('.login-submit')
await page.waitForTimeout(5000)
const after = await page.evaluate(() => ({
  url: location.href,
  token: !!localStorage.getItem('yj_token') || Object.keys(localStorage).filter(k => /token/i.test(k)),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('AFTER-LOGIN ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: OUT + '/round-01-after-login.png' })
console.log('shot: ' + OUT + '/round-01-after-login.png')
await task.finish({ keep: [] })
