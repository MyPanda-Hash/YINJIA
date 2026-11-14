const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
const out = await page.evaluate(async () => {
  const origin = localStorage.getItem('mes_api_origin') || ''
  const token = localStorage.getItem('mes_token') || ''
  const base = (origin ? origin.replace(/\/$/, '') : location.origin) + '/api'
  const one = async (code) => {
    try {
      const r = await fetch(`${base}/px/getPanelConfig?panelCode=${code}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json()
      return { code, status: r.status, ok: j?.code, panelName: j?.data?.metadata?.panelName ?? null, msg: j?.msg || null, keys: Object.keys(j?.data || {}).slice(0, 8) }
    } catch (e) { return { code, error: String(e) } }
  }
  return { base, rows: [await one('PURCHASE_IN'), await one('SO_ORDER'), await one('PU_ORDER'), await one('SALES_ORDER_DETAIL')] }
})
console.log(JSON.stringify(out, null, 1))
