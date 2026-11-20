const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => {
  window.__ngErrors = []
  window.addEventListener('error', (e) => window.__ngErrors.push('ERR ' + (e.message || e.reason)))
  window.addEventListener('unhandledrejection', (e) => window.__ngErrors.push('REJ ' + (e.reason && (e.reason.message || e.reason))))
})
// 先把结论设成不合格(如果还没设)
const footSel = await page.evaluate(() => (document.querySelector('.qr-foot-table')?.innerText || '').replace(/\s+/g, ' '))
console.log('FOOT', footSel)
if (!footSel.includes('不合格')) {
  await page.evaluate(() => { const s = document.querySelector('.qr-foot-table .el-select'); if (s) s.click() })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').trim() === '不合格')
    if (opt) opt.click()
  })
  await page.waitForTimeout(800)
}
console.log('BAND', await page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ')))
// 点按钮并轮询提示
await page.evaluate(() => { const el = document.querySelector('.qr-band-ng'); if (el) el.click() })
const seen = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500)
  const s = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      msgs: [...document.querySelectorAll('.el-message, .el-message-box, .el-dialog')].map((m) => txt(m)).filter((t) => t && t.length < 120),
      hash: location.hash,
      busy: !!document.querySelector('.el-loading-mask:not([style*="display: none"])'),
    }
  })
  seen.push({ i, ...s })
  if (s.hash !== '#/panelx/list/QC_PROC_INSP') break
}
console.log(JSON.stringify(seen.slice(-8), null, 2))
console.log('ERRORS', JSON.stringify(await page.evaluate(() => window.__ngErrors)))
console.log('HASH', await page.evaluate(() => location.hash))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s13-debug.png' })
