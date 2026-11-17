// round-18:8090 打包版复验「明细」表头 + 空态区间 + 本月已审核
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3500)
}
console.log('WEEK', JSON.stringify(await page.evaluate(() => ({
  headers: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__header th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
  empty: [...document.querySelectorAll('.iss-table .el-table__empty-text')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  stats: [...document.querySelectorAll('.iss-stat b')].map((n) => n.textContent.trim()),
}))))
await page.screenshot({ path: `${OUT}/19-8090-week-empty.png` })
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)
console.log('MONTH', JSON.stringify(await page.evaluate(() => ({
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  row: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__body-wrapper tbody tr')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: `${OUT}/20-8090-month-audited.png` })
await task.finish({ keep: [] })
