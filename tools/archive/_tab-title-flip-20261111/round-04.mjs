const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
// 硬刷新拿到最新源码
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: -1, uploadThroughput: -1 })
  console.log('network latency=400ms')
} catch (e) { console.log('throttle skip ' + e.message) }

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  const chips = [...document.querySelectorAll('.doc-chip')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return { hash: location.hash, tabs, act, chip: chips[0] || '' }
}

const NAMES = { SO_ORDER: '销售订单', SALES_ORDER_DETAIL: '销售订单明细表', PU_ORDER: '采购订单', PURCHASE_IN: '采购入库单' }
// 逐个打开 4 张页签（每张等它自己加载完）
for (const p of ['/panelx/list/PURCHASE_IN', '/panelx/list/SO_ORDER', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(4000)
}
console.log('OPENED ' + JSON.stringify(await page.evaluate(read)))

// 页签 ↔ 路径 的对照（快照里应有 4 个名字，且互不相同）
const before = await page.evaluate(read)
console.log('TABNAMES ' + JSON.stringify(before.tabs))

// 反复快速来回点：只等 250ms（< 400ms 网络延迟 ⇒ 配置请求还在飞）
const seq = ['SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'SALES_ORDER_DETAIL', 'PU_ORDER', 'SO_ORDER']
const snaps = []
for (const code of seq) {
  await page.evaluate((nm) => {
    const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === nm)
    if (el) el.click()
  }, NAMES[code])
  await page.waitForTimeout(250)
  snaps.push(await page.evaluate(read))
}
await page.waitForTimeout(6000)
snaps.push(await page.evaluate(read))

let bad = 0
for (const s of snaps) {
  const code = s.hash.replace('#/panelx/list/', '')
  const wantName = NAMES[code] || code
  const wantAct = s.tabs.indexOf(wantName)
  const ok = s.act === wantAct
  if (!ok) bad++
  console.log(`${ok ? 'OK ' : 'BAD'} hash=${code} act=${s.act} want=${wantAct}(${wantName}) tabs=[${s.tabs.join('|')}] chip=[${s.chip}]`)
}
console.log('TABNAMES_AFTER ' + JSON.stringify(snaps[snaps.length - 1].tabs))
console.log(bad === 0 ? 'VERDICT PASS 页签名不再横跳' : `VERDICT FAIL bad=${bad}`)

await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-04.png' })
try { await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }) } catch (e) {}
