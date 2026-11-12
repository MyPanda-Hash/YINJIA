// 2026-11-12 round-06：禁用缓存重载，确认「本线待做」标记与打印按钮
const task = await taskSpace('wo-board-flow-20261112')
const page = task.page('p1')
try { await page.cdp('Network.enable', {}) } catch (e) {}
try { await page.cdp('Network.setCacheDisabled', { cacheDisabled: true }) } catch (e) { console.log('cache ctl skip: ' + e.message) }
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.textContent || '').includes('装箱2'))
  if (!el) return 'not-found'
  el.click()
  return 'ok'
})
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row')]
  const target = rows.find((tr) => (tr.textContent || '').includes('GD-2026-11-0012'))
  return {
    line: (document.querySelector('.wb-ctx-label') || {}).textContent || '',
    tags: [...document.querySelectorAll('.wb-tag-line')].map((t) => (t.textContent || '').trim()),
    targetText: target ? (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) : 'row-not-found',
    hasTagInTarget: target ? !!target.querySelector('.wb-tag-line') : false,
  }
})
console.log('clicked=' + clicked)
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-flow-20261112/round-06-packline-tag.png' })
