// round-01 — 生产环境(36.140.66.163:8090)登录 + 打开「检验数据记录明细表」取证
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 90000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 90000 })
await page.waitForTimeout(2500)
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
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(300)
}
await page.click('.login-submit')
await page.waitForTimeout(5000)
console.log('after login url: ' + await page.url())

await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 90000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const body = document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)
  const tables = [...document.querySelectorAll('table')].map((t, i) => ({
    i,
    rows: t.querySelectorAll('tbody tr').length,
    head: [...t.querySelectorAll('thead th')].map((th) => th.innerText.trim()).slice(0, 20).join(' | '),
  }))
  return { url: location.href, body, tables }
})
console.log('PANEL ' + JSON.stringify(info, null, 2))
await page.screenshot({ path: OUT + '/round-01-panel.png' })
console.log('shot ok')
