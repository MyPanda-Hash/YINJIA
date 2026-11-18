const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/getPanelConfig?panelCode=WO_REPORT_LIST', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const d = j.data || {}
  return {
    status: r.status,
    keys: Object.keys(d),
    queryFields: d.queryFields,
    metadata: d.metadata,
    firstTabCols: d.detail && d.detail.tabs && d.detail.tabs[0] && d.detail.tabs[0].columns,
  }
})
console.log(JSON.stringify(out, null, 2).slice(0, 4000))
