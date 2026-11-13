const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const body = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120))
console.log('BODY ' + body)

await page.evaluate(() => {
  window.__tabLog = []
  const read = () => [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const snap = (why) => window.__tabLog.push({ t: Math.round(performance.now()), why, hash: location.hash, tabs: read(), docTitle: document.title })
  window.__snap = snap
  new MutationObserver((muts) => {
    for (const m of muts) {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target
      if (el && el.closest && el.closest('.tabsbar')) { snap('dom'); return }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
  snap('init')
})

// 打开 采购入库单 / 采购订单 / 销售订单明细表（每张等它加载完）
for (const p of ['/panelx/list/PURCHASE_IN', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(3000)
}
console.log('OPENED ' + JSON.stringify(await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.tabsbar .tab span')].map((s) => s.textContent.trim()), hash: location.hash }))))
await page.evaluate(() => window.__tabLog.push({ mark: '=== 开始快速来回点 ===', hash: location.hash }))

// 快速来回点（模拟"反复横跳"的现场：手快连点页签）
const seq = ['SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SO_ORDER', 'SALES_ORDER_DETAIL', 'PU_ORDER', 'SO_ORDER']
for (const code of seq) {
  await page.evaluate((code) => {
    const want = code === 'SO_ORDER' ? 1 : code === 'SALES_ORDER_DETAIL' ? 2 : 3 // 第 n 个非 affix 页签
    const els = [...document.querySelectorAll('.tabsbar .tab')].filter((t) => !(t.textContent || '').includes('我的桌面'))
    const el = els[want]
    if (el) el.click()
  }, code)
  await page.waitForTimeout(120)
}
await page.waitForTimeout(4000)
const log = await page.evaluate(() => window.__tabLog)
// 只打印标签数组发生变化的记录
const changes = []
let last = ''
for (const e of log) {
  const key = JSON.stringify(e.tabs || e.mark)
  if (key !== last) { changes.push(e); last = key }
}
console.log('CHANGES ' + JSON.stringify(changes, null, 1))
console.log('FINAL ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, tabs: [...document.querySelectorAll('.tabsbar .tab span')].map((s) => s.textContent.trim()), docTitle: document.title }))))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-02.png' })
