const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'QC_INSP_REQ', condition: { 物料编号: 'YJ-XH-001' }, pageNo: 1, pageSize: 1 }),
  })
  const j = await r.json()
  const doc = j?.data?.list?.[0] || {}
  const rows = (doc.detail && (doc.detail.items || doc.detail.qc_insp_req)) || []
  return {
    status: r.status,
    totalSize: j?.data?.totalSize,
    count: rows.length,
    cats: rows.map((x) => ({ id: x.id, 物料类别: x.物料类别 })),
  }
})
console.log(JSON.stringify(out, null, 2))
