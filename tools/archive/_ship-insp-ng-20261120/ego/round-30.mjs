const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    rows: [...document.querySelectorAll('tr')].filter((tr) => /ZJ-\d{4}/.test(txt(tr))).map((tr) => txt(tr)).slice(0, 30),
    tabs: [...document.querySelectorAll('.rail-tab, .ds-tab')].map((e) => txt(e)),
    body: txt(document.body).slice(0, 200),
  }
})
console.log(JSON.stringify(info, null, 2))
