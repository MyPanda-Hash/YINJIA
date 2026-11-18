const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const res = { hash: location.hash, hasToken: !!token, hasLogin: !!document.querySelector('input[placeholder*="密码"]'), probe: null, err: null }
  try {
    const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    res.probe = { status: r.status, text: (await r.text()).slice(0, 160) }
  } catch (e) { res.err = String(e) }
  return res
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-report-daterange-20261118/round-04.png' })
