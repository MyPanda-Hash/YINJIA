// round-01:库存状况面板(STOCK_STATUS)是否出现「金蝶数量 / 差异数量 / 金蝶同步时间」三列,且数值 = 金蝶现存量
// 任务:2026-11-10 库存数量以金蝶真实账套为准
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
}

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

await page.goto('http://127.0.0.1:8090/#/panelx/list/STOCK_STATUS', { timeout: 30000 })
await page.waitForTimeout(5000)
await loginIfNeeded()
await page.goto('http://127.0.0.1:8090/#/panelx/list/STOCK_STATUS', { timeout: 30000 })
await page.waitForTimeout(8000)

const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const bodyRows = [...document.querySelectorAll('tbody tr')].slice(0, 6)
  const rows = bodyRows.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return { hash: location.hash, headCount: heads.length, heads, rowCount: document.querySelectorAll('tbody tr').length, rows }
})
console.log(JSON.stringify(info, null, 2))
await shot('stock-status')
