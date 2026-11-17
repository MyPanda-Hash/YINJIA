// round-07:看侧栏全部操作入口 + 左侧选单栏
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').trim()),
  sideSections: [...document.querySelectorAll('.as-side, .as-side-sec, .as-side-title')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)).slice(0, 12),
  leftText: (document.querySelector('.as-left, .px-left, .doc-list') || {}).textContent ? (document.querySelector('.as-left, .px-left, .doc-list').textContent || '').replace(/\s+/g, ' ').slice(0, 300) : null,
  docPicker: [...document.querySelectorAll('div,span')].some((e) => (e.textContent || '').trim() === '新增'),
})), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-07.png', fullPage: false })
