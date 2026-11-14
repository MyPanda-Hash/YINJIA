const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    hash: location.hash,
    title: document.title,
    inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.name || '(no-ph)').slice(0, 12),
    hasFactorySelect: !!document.querySelector('.factory, .login-factory, .el-select'),
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-01.png' })
console.log('spaceId=' + task.spaceId)
