const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const state = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  body: (document.body.innerText || '').slice(0, 800),
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s1.png' })
