// round-03:填密码切到测试账套 → 打开采购入库单列表 → 选中草稿 PI-2026-10-0104
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/stock-sync-kingdee-20261110'

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

// 1) 密码 + 切换并重新登录
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = document.querySelector('.el-dialog input')
  if (inp) setVal(inp, '123456')
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('切换'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)

const after = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('.factory .factory-name') || {}).textContent || '(未找到)',
}))
console.log('切换后:', JSON.stringify(after))
await shot('round-03a-after-switch')

// 2) 打开采购入库单列表
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(7000)
const list = await page.evaluate(() => ({
  hash: location.hash,
  rows: document.querySelectorAll('tbody tr').length,
  firstRows: [...document.querySelectorAll('tbody tr')].slice(0, 3).map((tr) =>
    [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
}))
console.log('列表:', JSON.stringify(list).slice(0, 800))
await shot('round-03b-list')
