const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/panelx/list/RD_SPEC_DOC', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(9000)
try { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('不保存')); if (b) b.click() }) } catch (e) {}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const cover = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const labels = tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  const i = labels.findIndex((x) => x === '客户料号')
  return { hash: location.hash, hasCode: labels.includes('客户编码'), around: labels.slice(Math.max(0, i - 5), i + 6) }
})
console.log(JSON.stringify(cover, null, 1))
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/spec-cover-custcode.png' })
console.log('shot =', shot)
