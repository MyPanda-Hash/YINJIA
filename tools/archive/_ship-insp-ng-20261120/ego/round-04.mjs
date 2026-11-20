const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    title: document.title,
    hash: location.hash,
    hasOld: txt(document.body).includes('出货检验单功能'),
    hasNew: txt(document.body).includes('出货检验（功能）'),
    head: txt(document.body).slice(0, 220),
    menuQc: [...document.querySelectorAll('*')].filter((e) => /出货检验/.test(txt(e)) && e.children.length === 0).map((e) => txt(e)).slice(0, 8),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s4-rename.png' })
