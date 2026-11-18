const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) {}
await page.goto('http://localhost:5173/#/panelx/list/QC_TC_IN?docNo=TCI-2026-11-0001', { timeout: 30000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(800)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.q-date-in input')]
  const vals = ['2026', '11', '18', '2026', '11', '18']
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  ins.slice(0, 6).forEach((el, i) => setVal(el, vals[i]))
  // 滚到纸面底部(部门会签行在下面)
  const sc = [...document.querySelectorAll('div')].filter((el) => el.scrollHeight - el.clientHeight > 60 && el.clientHeight > 250)
  sc.forEach((el) => { el.scrollTop = el.scrollHeight })
})
await page.waitForTimeout(1200)
const info = await page.evaluate(() => ({
  sheetW: Math.round((document.querySelector('.approval-sheet') || {}).getBoundingClientRect().width || 0),
  boxes: [...document.querySelectorAll('.q-date-in')].slice(0, 6).map((el) => ({
    w: Math.round(el.getBoundingClientRect().width), v: (el.querySelector('input') || {}).value,
  })),
  signDates: [...document.querySelectorAll('.q-sign-date')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
}))
console.log(JSON.stringify(info))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r08-tcin-dates-wide.png' })
