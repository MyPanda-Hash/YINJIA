// round-03：先看清 /px/getPanelConfig 的真实结构（dataSchema 不是数组），再定位「仓位」字段。
const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('bin-field-20261201')
const page = task.page('p1')
await page.goto(BASE + '/', { timeout: 30000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/getPanelConfig?panelCode=OTHER_IN&view=system', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const j = await r.json()
  const cfg = j.data || j
  const s = JSON.stringify(cfg)
  const hits = []
  let i = s.indexOf('仓位')
  while (i >= 0 && hits.length < 6) { hits.push(s.slice(Math.max(0, i - 160), i + 60)); i = s.indexOf('仓位', i + 1) }
  return { keys: Object.keys(cfg), dataSchemaType: typeof cfg.dataSchema, len: s.length, hits }
})
console.log(JSON.stringify(info, null, 2))
await task.finish({ keep: [] })
