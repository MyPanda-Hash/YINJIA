const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_BHC', { timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tr')].filter((tr) => /BHC-\d{4}/.test(txt(tr))).slice(0, 5).map((tr) => txt(tr))
  return {
    factory: txt(document.body).slice(0, 80),
    title: document.title,
    rows,
    sheet: txt(document.querySelector('.approval-sheet')).slice(0, 260),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s43-8090.png' })
