/**
 * round-01:打开「生产退料」列表页,确认版面(查询 + 扫码定位 + 可退单据分组)与数据。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(3500)

const info = await page.evaluate(() => {
  const dump = {}
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (/factory/i.test(k)) dump[k] = String(store.getItem(k) || '').slice(0, 80)
    }
  }
  return {
    hash: location.hash,
    title: document.title,
    factory: dump,
    sub: (document.querySelector('.mr-sub') || {}).innerText || '',
    groups: [...document.querySelectorAll('.mr-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
    docs: [...document.querySelectorAll('.mr-doc')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).slice(0, 5),
    err: (document.querySelector('.mr-err') || {}).innerText || '',
    hasOverlay: !!document.querySelector('vite-error-overlay'),
  }
})
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-01-list.png' })
