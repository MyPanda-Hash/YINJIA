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
  const a = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 50 })
  const b = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 50 })
  const c = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 1000 })
  const sumRows = (d) => (d && d.data && d.data.list ? d.data.list.reduce((s, r) => s + Number(r['报工数量'] || 0), 0) : null)
  return {
    a: { status: a.status, code: a.body.code, total: a.body.data && a.body.data.totalSize, rows: a.body.data && a.body.data.list && a.body.data.list.length, msg: a.body.message },
    b: { status: b.status, code: b.body.code, total: b.body.data && b.body.data.totalSize, rows: b.body.data && b.body.data.list && b.body.data.list.length, msg: b.body.message },
    c: { status: c.status, code: c.body.code, total: c.body.data && c.body.data.totalSize, rows: c.body.data && c.body.data.list && c.body.data.list.length, msg: c.body.message },
    sumOct: sumRows(c),
    keysA: a.body.data ? Object.keys(a.body.data) : null,
    dates: (c.body.data && c.body.data.list || []).map(r => String(r['单据日期']).slice(0, 10)).sort(),
  }
})
console.log(JSON.stringify(out, null, 2))
