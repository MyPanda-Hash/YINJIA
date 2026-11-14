const task = await taskSpace('tab-title-flip-20261111')
const page = await task.newPage()
await page.goto('http://127.0.0.1:8090/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const body = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 140))
console.log('BODY ' + body)
if (body.includes('进入系统')) {
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
  await page.waitForTimeout(8000)
  await page.evaluate(() => { location.hash = '#/panelx/list/SO_ORDER' })
  await page.waitForTimeout(6000)
}

try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: -1, uploadThroughput: -1 })
} catch (e) { console.log('throttle skip ' + e.message) }

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  return { hash: location.hash, tabs, act }
}
const NAMES = { SO_ORDER: '销售订单', SALES_ORDER_DETAIL: '销售订单明细表', PU_ORDER: '采购订单', PURCHASE_IN: '采购入库单' }
for (const p of ['/panelx/list/PURCHASE_IN', '/panelx/list/SO_ORDER', '/panelx/list/PU_ORDER', '/panelx/list/SALES_ORDER_DETAIL']) {
  await page.evaluate((p) => { location.hash = '#' + p }, p)
  await page.waitForTimeout(4000)
}
console.log('OPENED ' + JSON.stringify(await page.evaluate(read)))
const seq = ['SO_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'PU_ORDER', 'SALES_ORDER_DETAIL', 'SO_ORDER', 'SALES_ORDER_DETAIL']
let bad = 0
for (const code of seq) {
  await page.evaluate((nm) => {
    const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === nm)
    if (el) el.click()
  }, NAMES[code])
  await page.waitForTimeout(250)
  const s = await page.evaluate(read)
  const want = s.tabs.indexOf(NAMES[code])
  if (s.act !== want) { bad++; console.log(`BAD hash=${code} act=${s.act} want=${want} tabs=[${s.tabs.join('|')}]`) }
}
await page.waitForTimeout(5000)
const fin = await page.evaluate(read)
console.log('FINAL ' + JSON.stringify(fin) + ' 重名=' + JSON.stringify(fin.tabs.filter((t, i) => fin.tabs.indexOf(t) !== i)))
console.log(bad === 0 ? 'VERDICT PASS 8090 页签名稳定' : `VERDICT FAIL bad=${bad}`)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-08-8090.png' })
try { await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }) } catch (e) {}
