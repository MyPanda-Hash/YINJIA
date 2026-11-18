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
    return r.json()
  }
  const a = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 50 })
  const b = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 50 })
  const c = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 1000 })
  const dates = (c.data.list || []).map((r) => String(r['单据日期']).slice(0, 10))
  const sum = (c.data.list || []).reduce((s, r) => s + Number(r['报工数量'] || 0), 0)
  return {
    all: { total: a.data.totalSize, rows: a.data.list.length },
    oct: { total: b.data.totalSize, rows: b.data.list.length },
    octFull: { total: c.data.totalSize, rows: c.data.list.length, sum, min: dates.sort()[0], max: dates.sort()[dates.length - 1] },
    keys: Object.keys(a.data),
  }
})
console.log(JSON.stringify(out, null, 2))
