const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
const list = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('tr')].filter((tr) => /ZC-\d{4}/.test(txt(tr))).map((tr) => txt(tr)).slice(0, 25)
})
console.log('LIST', JSON.stringify(list))
const picked = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tr')].find((tr) => /ZC-2026-10-0131/.test(txt(tr)))
  if (!row) return '(not found)'
  row.click()
  return txt(row)
})
console.log('PICK', picked)
await page.waitForTimeout(3500)
const head = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return { head: txt(document.querySelector('.qr-head-table')), rows: document.querySelectorAll('.qr-grid tbody tr').length, band: txt(document.querySelector('.qr-band')), title: document.title, hash: location.hash }
})
console.log('HEAD', JSON.stringify(head, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s16-opened.png' })
