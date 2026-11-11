// 2026-11-11 工序按量流转:第 5 轮 —— 回退与「负在制」守卫
//   a) 工序3(组装)报 60(此时可报 60)
//   b) 弃审工序2(切炭)的报工 → 期望被拒(后道已报 60 > 新可加工量 0)
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')

async function queryWo() {
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
    if (inp) { s.call(inp, 'GD-QTY-TEST-11'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
    if (btn) btn.click()
  })
  await page.waitForTimeout(3500)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await queryWo()
// a) 选组装,报 60
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.mp-op')].find((el) => (el.textContent || '').includes('组装'))
  if (card) card.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const inp = document.querySelector('.mp-qty input')
  if (inp) { s.call(inp, '60'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '提交报工')
  if (btn) btn.click()
})
await page.waitForTimeout(4500)
await queryWo()
const after = await page.evaluate(() => [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('报完组装: ' + JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-05-a-all-reported.png' })

// b) 弃审切炭报工(BG-2026-11-0002):期望「负在制」拒绝
const unaudit = await page.evaluate(async () => {
  const res = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ panelCode: 'WO_REPORT', buttonName: '弃审', formData: { 单据编号: 'BG-2026-11-0002' }, buttonParam: {} }),
  })
  return { status: res.status, text: (await res.text()).slice(0, 500) }
})
console.log('弃审切炭(期望拒绝): ' + JSON.stringify(unaudit, null, 2))
