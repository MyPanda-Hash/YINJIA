// round-01 — 打开 8090 快速排产页,确认登录态与页面可访问(不改任何数据)
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
console.log('spaceId=' + task.spaceId)
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
const info = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  hasLoginForm: !!document.querySelector('input[type="password"]'),
  inputs: [...document.querySelectorAll('input')].slice(0, 8).map((i) => i.placeholder || i.type),
  buttons: [...document.querySelectorAll('button')].slice(0, 12).map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800),
}))
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-01.png', fullPage: false })
console.log('shot round-01.png')
