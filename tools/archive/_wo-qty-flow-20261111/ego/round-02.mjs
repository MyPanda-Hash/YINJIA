// 2026-11-11 工序按量流转:第 2 轮 —— 输入测试工单号查询,读三道工序卡片(应显示 可报/可加工量)
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 填工单号 + 点查询
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
  if (!inp) return 'no-input'
  setVal(inp, 'GD-QTY-TEST-11')
  return 'ok'
})
console.log('fill=' + filled)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(3500)

// ② 读工序卡片 + 工单头
const state = await page.evaluate(() => ({
  wo: [...document.querySelectorAll('.mp-kv')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  ops: [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  picked: (document.querySelector('.mp-op.is-active') || {}).textContent || '',
  qty: (document.querySelector('.mp-qty input') || {}).value || '',
  hint: (document.querySelector('.mp-warn') || {}).textContent || '',
  err: (document.querySelector('.mp-err') || {}).textContent || '',
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-02-ops-before.png' })
