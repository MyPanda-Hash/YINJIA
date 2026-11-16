// 2026-11-11 工序按量流转:第 4 轮 —— 工序2(切炭)可报 60:
//   a) 报 61 → 期望被拒(提示可报 60)
//   b) 报 60 → 期望通过,且工序3(组装)随即「可报 60」
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const setVal = () => {}
async function queryWo() {
  await page.evaluate(() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
    if (inp) { s.call(inp, 'GD-QTY-TEST-11'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
    if (btn) btn.click()
  })
  await page.waitForTimeout(3500)
}
async function pickOp(name) {
  await page.evaluate((n) => {
    const card = [...document.querySelectorAll('.mp-op')].find((el) => (el.textContent || '').includes(n))
    if (card) card.click()
  }, name)
  await page.waitForTimeout(600)
}
async function setQty(v) {
  return page.evaluate((val) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const inp = document.querySelector('.mp-qty input')
    if (inp) { s.call(inp, String(val)); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
    return inp ? inp.value : 'no-input'
  }, v)
}
async function submit() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '提交报工')
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
}
const snap = () => page.evaluate(() => ({
  ops: [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  hint: (document.querySelector('.mp-warn') || {}).textContent || '',
  err: (document.querySelector('.mp-err') || {}).textContent || '',
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()),
}))

await queryWo()
await pickOp('切炭')
console.log('qty => ' + await setQty(61))
await page.waitForTimeout(300)
console.log('A. 报 61 前提示: ' + JSON.stringify(await snap()))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-04-a-over-limit-before.png' })
await submit()
console.log('B. 报 61 结果: ' + JSON.stringify(await snap(), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-04-b-over-limit-rejected.png' })

await queryWo()
await pickOp('切炭')
console.log('qty => ' + await setQty(60))
await page.waitForTimeout(300)
await submit()
const done = await snap()
console.log('C. 报 60 结果: ' + JSON.stringify(done, null, 2))
const wo = await page.evaluate(() => [...document.querySelectorAll('.mp-kv')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('工单头: ' + JSON.stringify(wo))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-04-c-after-report.png' })
