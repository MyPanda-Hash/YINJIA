const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tr')].filter((tr) => /ZC-\d{4}/.test(txt(tr)))
  const list = rows.slice(0, 20).map((tr) => txt(tr))
  // 找一张草稿
  const draft = rows.find((tr) => txt(tr).includes('草稿'))
  if (draft) draft.click()
  return { count: rows.length, list, picked: draft ? txt(draft) : '(no draft)' }
})
console.log(JSON.stringify(info, null, 2))
await page.waitForTimeout(3000)
const sheet = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const band = document.querySelector('.qr-band')
  const foot = document.querySelector('.qr-foot-table')
  return {
    title: txt(document.querySelector('.qr-title')),
    band: band ? txt(band) : '(no band)',
    foot: foot ? txt(foot) : '(no foot)',
    selects: [...document.querySelectorAll('.qr-foot-table .el-select')].map((s) => txt(s)),
  }
})
console.log(JSON.stringify(sheet, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s11-sheet.png' })
