// round-31:切到「修订记录」页,确认最下层合并格只出现在检验项目页
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
const clicked = await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.el-tabs__item')].find((e) => (e.textContent || '').includes('修订记录'))
  if (tab) { tab.click(); return true }
  return false
})
console.log('tab clicked:', clicked)
await page.waitForTimeout(2500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-31-revision-tab.png' })
console.log(JSON.stringify(await page.evaluate(() => ({
  footerFields: document.querySelectorAll('.rsp-footer-field').length,
  headers: [...document.querySelectorAll('table.rs-dt th')].map((e) => (e.textContent || '').trim()),
  rows: document.querySelectorAll('table.rs-dt tbody tr').length,
  tableW: (document.querySelector('table.rs-dt') || {}).getBoundingClientRect ? document.querySelector('table.rs-dt').getBoundingClientRect().width : null,
})), null, 2))
