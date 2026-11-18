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
  const all = await post({ panelCode: 'WO_REPORT_LIST', condition: {}, pageNo: 1, pageSize: 50 })
  const oct = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 1, pageSize: 50 })
  const octP7 = await post({ panelCode: 'WO_REPORT_LIST', condition: { 开始日期: '2026-10-01', 结束日期: '2026-10-31' }, pageNo: 7, pageSize: 50 })
  const inv = await post({ panelCode: 'WO_COMPLETION_LIST', condition: {}, pageNo: 1, pageSize: 50 })
  return {
    all: { total: all.body.data && all.body.data.totalSize, sums: all.body.data && all.body.data.sums, keys: all.body.data && Object.keys(all.body.data) },
    oct: { total: oct.body.data && oct.body.data.totalSize, sums: oct.body.data && oct.body.data.sums },
    octP7: { total: octP7.body.data && octP7.body.data.totalSize, sums: octP7.body.data && octP7.body.data.sums },
    completion: { status: inv.status, total: inv.body.data && inv.body.data.totalSize, sums: inv.body.data && inv.body.data.sums, msg: inv.body.message },
  }
})
console.log(JSON.stringify(out, null, 2))
