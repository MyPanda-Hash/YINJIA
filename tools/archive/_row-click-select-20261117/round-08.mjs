// round-08.mjs — 先看浏览器现在停在哪(round-07 里 .el-table 全没了,先确认页面/登录态)
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
console.log('pages:', JSON.stringify((await task.pages()).map((p) => p.label)))
console.log('tabs:', JSON.stringify((await task.tabs()).map((t) => ({ label: t.label || null, url: t.url, active: t.active }))))
const page = (await task.pages())[0]
console.log('url:', await page.url())
console.log('info:', JSON.stringify(await page.info()).slice(0, 400))
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('after goto:', await page.url())
const snap = await page.evaluate(() => ({
  hash: location.hash,
  tables: document.querySelectorAll('.el-table').length,
  rows: document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length,
  login: !!document.querySelector('input[placeholder*="账号"]'),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('snap:', JSON.stringify(snap))
