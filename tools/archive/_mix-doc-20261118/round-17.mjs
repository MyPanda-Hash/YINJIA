/**
 * round-17:看屏幕上到底是什么(浮层是不是挡住了页面),并确认明细页当前渲染状态。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => ({
  overlay: !!document.querySelector('vite-error-overlay'),
  overlayHTML: (document.querySelector('vite-error-overlay') || {}).outerHTML?.slice(0, 200) || '',
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  undoGone: !document.querySelector('.mp-line-undo'),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-17-overlay.png' })
