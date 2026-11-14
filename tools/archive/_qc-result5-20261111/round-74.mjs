const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(1200)
  }
  const w2 = await page.cdp('Browser.getWindowForTarget', {})
  console.log('window now=' + JSON.stringify(w2))
} catch (e) { console.log('bounds err: ' + e.message) }
await page.reload ? null : null
await page.waitForTimeout(2500)

const st = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const td = document.querySelectorAll('.qr-foot-table tr')[1]?.querySelector('td:last-child')
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 18),
    disposal: td ? (txt(td) || '') : null,
    verdict: txt(document.querySelectorAll('.qr-foot-table tr')[0]?.querySelector('td:last-child')) || null,
  }
})
console.log(JSON.stringify(st, null, 2))

// 点开处理意见下拉:库已清空,应该没有任何候选
await page.evaluate(() => {
  const td = document.querySelectorAll('.qr-foot-table tr')[1]?.querySelector('td:last-child')
  const s = td?.querySelector('.el-select__wrapper')
  if (s) s.click()
})
await page.waitForTimeout(1200)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((o) => o.offsetParent !== null).map((o) => (o.textContent || '').trim()))
console.log('options=' + JSON.stringify(opts))
try {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-74-disposal-empty.png' })
  console.log('shot ok')
} catch (e) { console.log('shot fail: ' + e.message) }
