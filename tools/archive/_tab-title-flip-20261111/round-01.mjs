const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

let probe = await page.evaluate(() => ({ hash: location.hash, title: document.title, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }))
console.log('START ' + JSON.stringify(probe))

// 登录（会话过期时）
if (probe.body.includes('进入系统') || probe.hash.includes('/login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { location.hash = '#/panelx/list/SO_ORDER' })
  await page.waitForTimeout(5000)
}

// 观测：任何时刻页签标签变化都记一条（带时间与当时 hash）
await page.evaluate(() => {
  window.__tabLog = []
  const read = () => [...document.querySelectorAll('.tabsbar .tab')].map((el) => {
    const sp = el.querySelector('span')
    return (sp ? sp.textContent : el.textContent || '').replace(/\s+/g, ' ').trim()
  })
  window.__readTabs = read
  const snap = (why) => {
    window.__tabLog.push({ t: Math.round(performance.now()), why, hash: location.hash, tabs: read(), title: document.title })
  }
  window.__snap = snap
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target
      if (el && el.closest && el.closest('.tabsbar')) { snap('dom'); return }
    }
  })
  obs.observe(document.body, { subtree: true, childList: true, characterData: true })
  snap('init')
})

// 依次打开 4 张单（点左侧菜单不可靠，直接改路由，PortalLayout 会补页签）
const paths = ['/panelx/list/PURCHASE_IN', '/panelx/list/SO_ORDER', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']
for (const p of paths) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(2500)
  await page.evaluate((p) => window.__snap('goto ' + p), p)
}
console.log('AFTER OPEN ' + JSON.stringify(await page.evaluate(() => window.__readTabs())))

// 在两张单之间来回点 8 次，记录每次点完后的标签
const clicks = ['SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'SALES_ORDER_DETAIL', 'PU_ORDER', 'SO_ORDER', 'PURCHASE_IN', 'SALES_ORDER_DETAIL']
for (let i = 0; i < clicks.length; i++) {
  const code = clicks[i]
  await page.evaluate((code) => {
    const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').includes(code === 'SO_ORDER' ? '销售订单' : code === 'SALES_ORDER_DETAIL' ? '销售订单明细表' : code === 'PU_ORDER' ? '采购订单' : '采购入库单'))
    if (el) el.click()
  }, code)
  await page.waitForTimeout(1800)
  console.log('CLICK ' + code + ' -> ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, tabs: window.__readTabs(), title: document.title }))))
}
await page.waitForTimeout(1500)
console.log('LOG ' + JSON.stringify(await page.evaluate(() => window.__tabLog), null, 1))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-01.png' })
console.log('spaceId=' + task.spaceId)
