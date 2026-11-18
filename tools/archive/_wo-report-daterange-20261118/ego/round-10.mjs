const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/getPanelConfig?panelCode=WO_REPORT_LIST', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const d = j.data || {}
  const qf = (d.queryFields || []).filter((f) => String(f.dataType).includes('日期'))
  return { status: r.status, dateQueryFields: qf, metadata: d.metadata, queryInputRef: d.metadata && d.metadata.queryInputRef }
})
console.log(JSON.stringify(out, null, 2))
