const task = await taskSpace('jjf-twolevel-20261117')
const page = task.page('p1')
for (const code of ['QC_BHC', 'QC_TC_IN']) {
  await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 30000 })
  await page.waitForTimeout(4000)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
  const dept = await page.evaluate(() => [...document.querySelectorAll('.q-dept')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 3))
  console.log(code, JSON.stringify(dept))
  await page.screenshot({ path: `C:/Users/vigna/ego/jjf-twolevel-20261117/r05-${code}.png` })
}
console.log('done')
