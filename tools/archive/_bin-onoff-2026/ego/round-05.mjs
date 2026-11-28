// round-05（终版取证）：明细字段在 cfg.detail 里（dataSchema.fields 只是表头）。
// 逐面板取出「仓位 / 仓位编码」明细字段的最终形状（类型/参照/级联/只读/隐藏）。
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
    if (!r.ok) return { httpError: r.status }
    const body = await r.json()
    const cfg = body.data || body
    const detail = Array.isArray(cfg.detail) ? cfg.detail : (cfg.detail && cfg.detail.fields) || []
    const heads = (cfg.dataSchema && cfg.dataSchema.fields) || []
    const pick = (arr) => arr.filter((f) => f.dataName === '仓位' || f.dataName === '仓位编码')
      .map((f) => ({ dataName: f.dataName, dataType: f.dataType, refPanel: f.refPanel, refField: f.refField, filter: f.filter, readonly: f.readonly, hidden: f.hidden }))
    return {
      panelName: (cfg.metadata && cfg.metadata.panelName) || '',
      detailCount: detail.length,
      detailBin: pick(detail),
      headerBin: pick(heads),
    }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-05.png' })
await task.finish({ keep: [] })
