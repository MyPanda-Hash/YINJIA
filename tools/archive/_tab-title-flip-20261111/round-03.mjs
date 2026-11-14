const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)

// 让接口变慢（现场是远程服务器，配置请求几百 ms；本地 vite 全命中缓存所以复现不到race）
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: -1, uploadThroughput: -1 })
  console.log('network latency=400ms')
} catch (e) { console.log('throttle skip ' + e.message) }

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  const chips = [...document.querySelectorAll('.doc-chip, .portal-content strong, .as-side-title span')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return { hash: location.hash, tabs, act, chips: chips.slice(0, 4), docTitle: document.title }
}

// 关掉已有页签，重新开 4 张
for (const p of ['/panelx/list/PURCHASE_IN', '/panelx/list/SO_ORDER', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(4000)
}
console.log('OPENED ' + JSON.stringify(await page.evaluate(read)))

// 反复快速来回点，每次只等 250ms（< 400ms 网络延迟 ⇒ 请求还在飞）
const seq = ['SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'SALES_ORDER_DETAIL']
const snapshots = []
for (const code of seq) {
  await page.evaluate((code) => {
    const names = { SO_ORDER: '销售订单', SALES_ORDER_DETAIL: '销售订单明细表', PU_ORDER: '采购订单', PURCHASE_IN: '采购入库单' }
    const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === names[code])
    if (el) el.click()
  }, code)
  await page.waitForTimeout(250)
  snapshots.push(await page.evaluate(read))
}
await page.waitForTimeout(5000)
snapshots.push(await page.evaluate(read))

for (const s of snapshots) {
  // 用一个字符串直观看：页签标签 / 活动页签下标 / 面板自称的名字
  console.log(`hash=${s.hash.replace('#/panelx/list/', '')} act=${s.act} tabs=[${s.tabs.join('|')}] panel=[${(s.chips[0] || '')}]`)
}
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-03.png' })
try { await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }) } catch (e) {}
