// round-14:看这一页到底发了哪些 api 请求(确认 loadStdLibs 有没有跑)
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => {
  const res = performance.getEntriesByType('resource').map((r) => r.name)
  return {
    apiCalls: res.filter((n) => n.includes('/api/')).map((n) => n.replace('http://localhost:5173', '')).slice(0, 40),
    stdlib: res.filter((n) => n.includes('stdlib')),
    count: res.length,
  }
}), null, 2))
