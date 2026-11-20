const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
// click the first data row in the left list
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((tr) => /ZC-\d{4}/.test(tr.innerText || ''))
  if (!rows.length) return 'no rows'
  rows[0].click()
  return (rows[0].innerText || '').replace(/\s+/g, ' ').trim()
})
console.log('CLICKED:', clicked)
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const buttons = [...document.querySelectorAll('button')].map((b) => txt(b)).filter((t) => t && t.length < 20)
  const sheet = document.querySelector('[class*="approval-sheet"], [class*="rsp-"], .qr-sheet, .sheet')
  return {
    hash: location.hash,
    buttons: [...new Set(buttons)].slice(0, 60),
    sheetText: sheet ? txt(sheet).slice(0, 1500) : '(no sheet)',
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s2.png' })
