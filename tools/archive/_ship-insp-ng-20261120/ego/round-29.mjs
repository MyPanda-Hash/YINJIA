const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const picked = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tr')].find((tr) => /ZJ-2026-10-0135/.test(txt(tr)))
  if (!row) return '(not found)'
  row.click()
  return txt(row)
})
console.log('PICK', picked)
await page.waitForTimeout(3500)
console.log('STATE', JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return { title: document.title, band: txt(document.querySelector('.qr-band')), head: txt(document.querySelector('.qr-head-table')), rows: document.querySelectorAll('.qr-grid tbody tr').length }
})))
// 设 检验结论=不合格
await page.evaluate(() => { const s = document.querySelector('.qr-foot-table .el-select'); if (s) s.click() })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').trim() === '不合格')
  if (opt) opt.click()
})
await page.waitForTimeout(900)
console.log('BAND2', await page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ')))
await page.evaluate(() => { const el = document.querySelector('.qr-band-ng'); if (el) el.click() })
const seen = []
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(600)
  const s = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return { msgs: [...document.querySelectorAll('.el-message')].map((m) => txt(m)).filter(Boolean), hash: location.hash }
  })
  seen.push({ i, ...s })
  if (s.hash !== '#/panelx/list/QC_ASM_INSP') break
}
console.log('RESULT', JSON.stringify(seen.slice(-3), null, 2))
console.log('TARGET HEAD', await page.evaluate(() => (document.querySelector('.approval-sheet')?.innerText || '').replace(/\s+/g, ' ').slice(0, 260)))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s29-asm-jump.png' })
