const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const post = async (body) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    return { status: r.status, body: await r.json() }
  }
  const adv = [
    { field: '单据日期', op: 'ge', value: '2026-10-01' },
    { field: '单据日期', op: 'le', value: '2026-10-31' },
  ]
  const b = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, advFilters: adv, pageNo: 1, pageSize: 50 })
  const c = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, advFilters: adv, pageNo: 1, pageSize: 1000 })
  const rows = (c.body.data && c.body.data.list) || []
  const dates = rows.map(r => String(r['单据日期']).slice(0, 10)).sort()
  return {
    statusB: b.status, totalB: b.body.data && b.body.data.totalSize, rowsB: b.body.data && b.body.data.list && b.body.data.list.length, msgB: b.body.message,
    statusC: c.status, totalC: c.body.data && c.body.data.totalSize, rowsC: rows.length, msgC: c.body.message,
    sumOct: rows.reduce((s, r) => s + Number(r['报工数量'] || 0), 0),
    min: dates[0], max: dates[dates.length - 1],
  }
})
console.log(JSON.stringify(out, null, 2))
