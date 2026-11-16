// 2026-11-11 工序按量流转:第 3 轮 —— 工序1(成型)只报 180/270(部分完工),
// 期望:工序2(切炭)随即「可报 60」(= 180 ÷ 换算率3),不需要等成型报满 270。
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const setQty = async (v) => page.evaluate((val) => {
  const setVal = (el, x) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, x)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = document.querySelector('.mp-qty input')
  if (inp) setVal(inp, String(val))
  return inp ? inp.value : 'no-qty-input'
}, v)

// ① 查询工单
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
  if (inp) setVal(inp, 'GD-QTY-TEST-11')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(3500)

// ② 选「成型」,数量 180,提交
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.mp-op')].find((el) => (el.textContent || '').includes('成型'))
  if (card) card.click()
})
await page.waitForTimeout(600)
console.log('qty set => ' + await setQty(180))
await page.waitForTimeout(300)
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-03-a-before-submit.png' })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '提交报工')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)

// ③ 读结果:成型 180/270,切炭 可报 60
const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
  ops: [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  wo: [...document.querySelectorAll('.mp-kv')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  today: [...document.querySelectorAll('.mp-line')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  err: (document.querySelector('.mp-err') || {}).textContent || '',
}))
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-03-b-after-report.png' })
