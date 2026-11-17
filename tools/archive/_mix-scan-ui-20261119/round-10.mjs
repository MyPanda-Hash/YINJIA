// 探针:用登录态直调接口,看 500 的响应体到底是什么
const task = await taskSpace('mix-scan-fuzzy-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(3000)
const out = await page.evaluate(async () => {
  const token = (localStorage.getItem('mes_token') || '').replace(/^"|"$/g, '')
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = 'Bearer ' + token
  const call = async (url, opt = {}) => {
    try {
      const r = await fetch(url, { ...opt, headers: { ...h, ...(opt.headers || {}) } })
      const t = await r.text()
      return { url, status: r.status, body: t.slice(0, 500) }
    } catch (e) { return { url, err: String(e && e.message) } }
  }
  const res = []
  res.push(await call('/api/px/workOrderList', { method: 'POST', body: JSON.stringify({ keyword: '0015' }) }))
  res.push(await call('/api/px/workOrderList', { method: 'POST', body: JSON.stringify({ keyword: 'GD-2026-11-0015' }) }))
  return { factory: localStorage.getItem('mes_factory'), token: !!token, res }
})
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: 'all' })
