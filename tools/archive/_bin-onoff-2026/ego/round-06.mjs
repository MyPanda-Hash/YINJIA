// round-06（终版取证）：直接在 /px/getPanelConfig 的原始 JSON 里按正则捞「仓位/仓位编码」字段对象。
// 不猜结构（dataSchema 是表头、detail 是别的形状），正则对"下发内容"本身取证。
const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('bin-field-20261201')
const page = task.page('p1')
await page.goto(BASE + '/', { timeout: 30000 })
await page.waitForTimeout(2500)

const panels = ['OTHER_IN', 'OTHER_OUT', 'FINISH_IN', 'MATERIAL_OUT', 'SALE_OUT', 'SALE_IN', 'MATERIAL_RET', 'PURCHASE_IN']
const out = {}
for (const code of panels) {
  out[code] = await page.evaluate(async (panelCode) => {
    const token = localStorage.getItem('mes_token')
    const r = await fetch(`/api/px/getPanelConfig?panelCode=${panelCode}&view=system`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const body = await r.json()
    const s = JSON.stringify(body)
    const hits = s.match(/\{"dataName":"(?:仓位|仓位编码)"[^{}]*\}/g) || []
    return {
      panelName: ((body.data || body).metadata || {}).panelName || '',
      count: hits.length,
      fields: hits,
    }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-06.png' })
await task.finish({ keep: [] })
