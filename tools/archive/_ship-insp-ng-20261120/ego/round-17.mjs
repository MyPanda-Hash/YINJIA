const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => { const s = document.querySelector('.qr-foot-table .el-select'); if (s) s.click() })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').trim() === '不合格')
  if (opt) opt.click()
})
await page.waitForTimeout(900)
console.log('BAND', await page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ')))
await page.evaluate(() => { const el = document.querySelector('.qr-band-ng'); if (el) el.click() })
const seen = []
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(600)
  const s = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      msgs: [...document.querySelectorAll('.el-message, .el-message-box')].map((m) => txt(m)).filter((t) => t && t.length < 160),
      hash: location.hash,
      title: document.title,
    }
  })
  seen.push({ i, ...s })
  if (s.hash !== '#/panelx/list/QC_PROC_INSP') break
}
console.log('LAST', JSON.stringify(seen.slice(-5), null, 2))
// 目标页读取纸面
const target = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.as-row, .as-name, .as-value, .as-info-label, .as-info-value')].map((e) => txt(e)).filter(Boolean)
  return {
    hash: location.hash, title: document.title,
    body: txt(document.body).slice(0, 500),
    paper: txt(document.querySelector('.approval-sheet'))?.slice(0, 900),
    cells: cells.slice(0, 40),
  }
})
console.log('TARGET', JSON.stringify(target, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s17-target.png', fullPage: false })
