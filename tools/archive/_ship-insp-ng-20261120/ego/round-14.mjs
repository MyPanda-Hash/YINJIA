const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const picked = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('tr')].filter((tr) => /ZC-2026-10-0131/.test(txt(tr)))
  if (rows.length) { rows[0].click(); return txt(rows[0]) }
  return '(not found)'
})
console.log('PICK', picked)
await page.waitForTimeout(3500)
// 设 检验结论=不合格
await page.evaluate(() => { const s = document.querySelector('.qr-foot-table .el-select'); if (s) s.click() })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').trim() === '不合格')
  if (opt) opt.click()
})
await page.waitForTimeout(900)
const band = await page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' '))
console.log('BAND', band)
// 点按钮
await page.evaluate(() => { const el = document.querySelector('.qr-band-ng'); if (el) el.click() })
const seen = []
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(600)
  const s = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      msgs: [...document.querySelectorAll('.el-message, .el-message-box')].map((m) => txt(m)).filter((t) => t && t.length < 150),
      hash: location.hash,
    }
  })
  seen.push({ i, ...s })
  if (s.hash !== '#/panelx/list/QC_PROC_INSP') break
}
console.log('LAST', JSON.stringify(seen.slice(-4), null, 2))
console.log('HASH', await page.evaluate(() => location.hash))
console.log('TITLE', await page.evaluate(() => document.title))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s14-after-click.png' })
