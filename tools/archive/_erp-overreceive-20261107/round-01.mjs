// 只读:登录现场服务器 MES(正式库 YJ),用面板接口读采购订单/采购入库单的数量口径。
// 不点任何保存/审核/转ERP。第 1 轮:先看登录页形态。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const st = await page.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  title: document.title,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  inputs: [...document.querySelectorAll('input')].map((i) => ({
    ph: i.placeholder, type: i.type, val: i.value,
  })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 20),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/erp-overreceive-20261107/round-01.png' })
