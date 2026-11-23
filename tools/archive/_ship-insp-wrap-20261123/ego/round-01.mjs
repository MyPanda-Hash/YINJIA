const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
const state = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
    rows: [...document.querySelectorAll('tr')].filter((tr) => /ZC-\d{4}/.test(tr.innerText || '')).map((tr) => txt(tr)).slice(0, 10),
    body: txt(document.body).slice(0, 500),
  }
})
console.log(JSON.stringify(state, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s1-list.png' })
