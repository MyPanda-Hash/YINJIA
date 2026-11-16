// round-01.mjs — 扫码混料验收:打开登录页,看一眼登录工厂/账号框
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 40000 })
await page.waitForTimeout(2500)
console.log(JSON.stringify({ hash: await page.evaluate(() => location.hash) }))
console.log(await page.snapshot())
