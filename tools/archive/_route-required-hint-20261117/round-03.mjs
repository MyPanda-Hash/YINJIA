const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

console.log(JSON.stringify(await page.evaluate(() => {
  const star = (el) => {
    try { return getComputedStyle(el, '::before').content } catch { return 'n/a' }
  }
  const headLabels = [...document.querySelectorAll('.fields .field label')].map((el) => ({
    text: (el.textContent || '').trim(),
    req: el.classList.contains('req'),
    star: star(el),
  }))
  const colHdrs = [...document.querySelectorAll('.col-hdr-text')].slice(0, 10).map((el) => ({
    text: (el.textContent || '').trim(),
    req: el.classList.contains('req'),
    star: star(el),
  }))
  return {
    hash: location.hash,
    docNo: document.querySelector('.fields .field input')?.value || '',
    headLabels,
    colHdrs,
    reqStarSpans: document.querySelectorAll('.req-star').length,
  }
}), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-03-markers.png' })
