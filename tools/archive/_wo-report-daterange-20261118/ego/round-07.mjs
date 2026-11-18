const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const post = async (cond, adv) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'WO_REPORT_LIST', condition: cond || {}, advFilters: adv, pageNo: 1, pageSize: 20 }),
    })
    const j = await r.json()
    return { status: r.status, total: j.data && j.data.totalSize, rows: j.data && j.data.list && j.data.list.length, msg: j.message, first: j.data && j.data.list && j.data.list[0] && { d: j.data.list[0]['单据日期'], q: j.data.list[0]['报工数量'], g: j.data.list[0]['工序'] } }
  }
  return {
    geDate: await post({}, [{ field: '单据日期', op: 'ge', value: '2026-10-01' }]),
    leDate: await post({}, [{ field: '单据日期', op: 'le', value: '2026-10-31' }]),
    containsGx: await post({}, [{ field: '工序', op: 'contains', value: '成型' }]),
    geQty: await post({}, [{ field: '报工数量', op: 'ge', value: '1000' }]),
    eqDate: await post({}, [{ field: '单据日期', op: 'eq', value: '2026-10-21' }]),
  }
})
console.log(JSON.stringify(out, null, 2))
