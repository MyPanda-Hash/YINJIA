const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/getPanelConfig?panelCode=WO_REPORT_LIST', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const d = j.data || {}
  const qf = (d.queryFields || []).map((f) => ({ dataName: f.dataName, code: f.code, displayName: f.displayName, dataType: f.dataType }))
  return { status: r.status, keys: Object.keys(d), queryFields: qf, metadata: d.metadata }
})
console.log(JSON.stringify(out, null, 2))
