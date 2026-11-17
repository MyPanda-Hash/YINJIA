// round-04:带 token 复现 500,拿后端错误响应体
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')

const out = await page.evaluate(async () => {
  const tok = localStorage.getItem('mes_token') || ''
  const H = { Accept: 'application/json', Authorization: 'Bearer ' + tok }
  const res = {}
  try {
    const r = await window.fetch('/api/px/getPanelConfig?panelCode=WO_REPORT_LIST', { headers: H })
    const t = await r.text()
    res.config = { status: r.status, body: t.slice(0, 900) }
  } catch (e) { res.config = { err: String(e) } }
  try {
    const r2 = await window.fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 2 }),
    })
    const t2 = await r2.text()
    res.query = { status: r2.status, body: t2.slice(0, 900) }
  } catch (e) { res.query = { err: String(e) } }
  return res
})
console.log('API ' + JSON.stringify(out, null, 2))
console.log('DONE round-04')
