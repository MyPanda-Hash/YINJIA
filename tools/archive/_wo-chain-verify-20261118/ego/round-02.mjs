// round-02: 登录(正式库 YJ) → 快速排产
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8091/', { timeout: 60000 })
await page.waitForTimeout(2000)
await page.click('text="YINJIA-MES·测试库"')
await page.waitForTimeout(600)
await page.click('text="YINJIA-MES"')
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('text="进入系统"')
await page.waitForTimeout(4500)
console.log('after login url=' + (await page.url()))
await page.goto('http://127.0.0.1:8091/#/prod/plan/scheduleBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
const dlg = await page.evaluate(() => ({
  hasPage: !!document.querySelector('.sb-page'),
  blocks: [...document.querySelectorAll('.sb-block-title')].map((x) => x.textContent.trim()),
  sw: [...document.querySelectorAll('.sb-head .el-switch')].length,
  filters: [...document.querySelectorAll('.sb-filters input')].map((i) => i.placeholder),
}))
console.log(JSON.stringify(dlg, null, 2))
try { await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-02-board.png' }) } catch (e) { console.log('shot skip: ' + e.message) }
