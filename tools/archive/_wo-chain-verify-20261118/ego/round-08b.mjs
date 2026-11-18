// round-08b: 8090 当前页面状态
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/', { timeout: 60000 })
await page.waitForTimeout(3000)
console.log('url=' + (await page.url()))
console.log(await page.snapshot())
