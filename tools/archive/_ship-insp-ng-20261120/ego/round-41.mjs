const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return { title: document.title, head: txt(document.querySelector('.approval-sheet')).slice(0, 400) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s41-bhc-en.png' })
