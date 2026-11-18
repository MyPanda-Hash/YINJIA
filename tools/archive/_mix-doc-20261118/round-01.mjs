/**
 * round-01:确认登录账套 + 打开「扫码混料」列表页,看新版面(查询 + 扫码定位 + 未完成/已完成两组)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3500)

const info = await page.evaluate(() => {
  const dump = {}
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      const v = String(store.getItem(k) || '')
      if (/token|factory|user|ledger/i.test(k)) dump[k] = v.length > 100 ? v.slice(0, 100) + '…' : v
    }
  }
  return {
    hash: location.hash,
    title: document.title,
    session: dump,
    hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 16),
    groups: [...document.querySelectorAll('.mm-grp-title')].map((el) => (el.textContent || '').trim()),
    emptyTexts: [...document.querySelectorAll('.mm-empty')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    docCards: [...document.querySelectorAll('.mm-doc')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  }
})
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-01-list.png' })
