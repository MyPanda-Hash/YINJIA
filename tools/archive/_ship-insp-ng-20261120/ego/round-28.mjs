const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const picked = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tr')].find((tr) => /ZC-2026-10-0131/.test(txt(tr)))
  if (!row) return '(not found)'
  row.click()
  return txt(row)
})
console.log('PICK', picked)
await page.waitForTimeout(3500)
const state = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return { band: txt(document.querySelector('.qr-band')), foot: txt(document.querySelector('.qr-foot-table')), ng: !!document.querySelector('.qr-band-ng') }
})
console.log('STATE', JSON.stringify(state))
await page.evaluate(() => { const el = document.querySelector('.qr-band-ng'); if (el) el.click() })
const seen = []
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(600)
  const s = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return { msgs: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).filter(Boolean), hash: location.hash }
  })
  seen.push({ i, ...s })
  if (s.hash !== '#/panelx/list/QC_PROC_INSP') break
}
console.log('RESULT', JSON.stringify(seen.slice(-3), null, 2))
