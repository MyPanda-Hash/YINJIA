// round-01: 打开 8091(新 jar 前端+后端),看登录页结构
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8091/', { timeout: 60000 })
await page.waitForTimeout(3000)
console.log(await page.snapshot())
try { await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-01-login.png' }) } catch (e) { console.log('shot skip: ' + e.message) }
