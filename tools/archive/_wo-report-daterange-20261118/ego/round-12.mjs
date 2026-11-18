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
  const all = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 1 })
  const oct = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 1 })
  const octAll = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 1000 })
  const day = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-21', 结束日期: '2026-10-21' }, pageNo: 1, pageSize: 50 })
  const nov1 = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-11-01', 结束日期: '2026-11-18' }, pageNo: 1, pageSize: 1 })
  const advOct = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, advFilters: adv, pageNo: 1, pageSize: 1 })
  const rows = (octAll.body.data && octAll.body.data.list) || []
  const ds = rows.map(r => String(r['单据日期']).slice(0, 10)).sort()
  return {
    allTotal: all.body.data && all.body.data.totalSize,
    octTotal: oct.body.data && oct.body.data.totalSize,
    octRowsFull: { total: octAll.body.data && octAll.body.data.totalSize, rows: rows.length, sum: rows.reduce((s, r) => s + Number(r['报工数量'] || 0), 0), min: ds[0], max: ds[ds.length - 1], status: octAll.status, msg: octAll.body.message },
    dayTotal: day.body.data && day.body.data.totalSize,
    daySum: (day.body.data && day.body.data.list || []).reduce((s, r) => s + Number(r['报工数量'] || 0), 0),
    novTotal: nov1.body.data && nov1.body.data.totalSize,
    advOctTotal: advOct.body.data && advOct.body.data.totalSize,
  }
})
console.log(JSON.stringify(out, null, 2))
