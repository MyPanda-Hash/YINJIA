// round-07（终版取证）：深度遍历 /px/getPanelConfig 返回的 JSON，捞出所有 dataName = 仓位 / 仓位编码 的字段对象。
// （前两轮踩坑：dataSchema.fields 只是表头、detail 不是数组、正则 [^{}]* 会被 filter 的嵌套花括号打断）
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
    const found = []
    const walk = (node, path) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach((x, i) => walk(x, path + '[' + i + ']')); return }
      if (node.dataName === '仓位' || node.dataName === '仓位编码') {
        found.push({ path, dataName: node.dataName, dataType: node.dataType, refPanel: node.refPanel,
          refField: node.refField, filter: node.filter, hidden: node.hidden, visible: node.visible, isRequired: node.isRequired })
      }
      for (const k of Object.keys(node)) walk(node[k], path + '.' + k)
    }
    walk(body.data || body, '')
    return { panelName: ((body.data || body).metadata || {}).panelName || '', found }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-07.png' })
await task.finish({ keep: [] })
