// round-04（终版取证）：从现役 8090 的 /api/px/getPanelConfig 逐面板取「仓位」字段的最终形状 +
// 该面板明细页签的列清单里有没有「仓位」。dataSchema 是对象 ⇒ 取 dataSchema.fields。
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
    const cfg = (await r.json()).data || await r.json()
    const fields = (cfg.dataSchema && cfg.dataSchema.fields) || []
    const bin = fields.filter((f) => f.dataName === '仓位' || f.dataName === '仓位编码')
    const tabs = ((cfg.metadata && cfg.metadata.panelPageDto && cfg.metadata.panelPageDto.tablePages) || [])
    const cols = tabs.length ? (tabs[0].columns || []) : []
    return {
      panelName: (cfg.metadata && cfg.metadata.panelName) || '',
      bin: bin.map((f) => ({
        dataName: f.dataName, dataType: f.dataType, width: f.width,
        refPanel: f.refPanel, refField: f.refField, filter: f.filter,
        readonly: f.readonly, hidden: f.hidden,
      })),
      binInColumns: cols.filter((c) => c === '仓位' || c === '仓位编码'),
    }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-04.png' })
await task.finish({ keep: [] })
