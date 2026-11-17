// round-03:从 5173 页面上下文直接打接口,看状态码/响应,并对比 8090
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
const probe = await page.evaluate(async () => {
  const keys = Object.keys(localStorage)
  const tokKey = keys.find((k) => /token/i.test(k))
  const raw = tokKey ? localStorage.getItem(tokKey) : ''
  let token = ''
  try { token = JSON.parse(raw)?.token || raw } catch { token = raw }
  const r = await fetch('/api/px/inspSummary/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ 日期起: '2026-11-01', 日期止: '2026-11-17', 单据状态: '全部' }),
  })
  const text = await r.text()
  return { tokKey, tokenLen: token.length, status: r.status, body: text.slice(0, 500) }
})
console.log(JSON.stringify(probe, null, 2))
await task.finish({ keep: [] })
