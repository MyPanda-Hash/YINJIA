// 2026-11-11 工序按量流转:第 10 轮 —— 无预排台账的工单行(回归保护)
//   前提:台账户 3 行已临时 asp_cancel='Y'(模拟"没排过线的工单行")
//   动作:成型再报 90(180+90=270 = 计划满) → 期望 plang 仍按量重算:当前工序=切炭、完工状态=在制
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
  if (inp) { s.call(inp, 'GD-QTY-TEST-11'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(3500)
const before = await page.evaluate(() => ({
  wo: [...document.querySelectorAll('.mp-kv')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  ops: [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  empty: (document.querySelector('.mp-empty') || {}).textContent || '',
}))
console.log('报工前(台账已作废): ' + JSON.stringify(before, null, 2))

// 用接口直接报成型 90(台账作废后前端没有工序卡片,只能走提交接口)
const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/workReport/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ woNo: 'GD-QTY-TEST-11', 工单行号: 1, 工序: '成型', 数量: 90, 报工人: 'admin' }),
  })
  return { status: r.status, text: (await r.text()).slice(0, 400) }
})
console.log('报成型 90(无台账): ' + JSON.stringify(res, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-10-no-ledger.png' })
