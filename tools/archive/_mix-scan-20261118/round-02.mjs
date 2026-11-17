// round-02.mjs — 打开「手机扫码 → 扫码混料」页面,输出页面骨架 + 截图
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 40000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
const state = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.mm-title')?.textContent?.trim() || '',
  sub: document.querySelector('.mm-sub')?.textContent?.trim() || '',
  hasWoInput: !!document.querySelector('.mm-scanbar input'),
  placeholders: [...document.querySelectorAll('.mm-scanbar input')].map((i) => i.placeholder),
  buttons: [...document.querySelectorAll('.mm-scanbar button, .mm-foot button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r2-page.png' })
