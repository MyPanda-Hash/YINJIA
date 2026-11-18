const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(6000)
const d = await page.evaluate(() => ({
  hash: location.hash,
  tabs: [...document.querySelectorAll('.el-tabs__item, .qc-tab, .rs-tab')].map((e) => (e.textContent || '').trim()).slice(0, 12),
  titles: [...document.querySelectorAll('h1,h2,h3,.panel-title,.dt-title')].map((e) => (e.textContent || '').trim()).slice(0, 5),
  tables: document.querySelectorAll('table').length,
  qcPaper: !!document.querySelector('.qc-paper'),
  bodyText: document.body.textContent.replace(/\s+/g, ' ').slice(0, 400),
}))
console.log(JSON.stringify(d, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r03a-diag.png' })
