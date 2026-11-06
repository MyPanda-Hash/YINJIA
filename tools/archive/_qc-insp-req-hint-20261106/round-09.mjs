const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const res = {}
  for (const code of ['YJ-XH-001', 'YJ-XH-002', 'YJ-YKRS-009', 'YJ-YKRS-014']) {
    const hit = []
    for (const panelCode of ['QC_INSP_REQ', 'QC_INSP_REQ_SERIES']) {
      const r = await window.fetch('/api/px/queryFormDataList', {
        method: 'POST', headers: H,
        body: JSON.stringify({ panelCode, condition: { 物料编号: code }, pageNo: 1, pageSize: 1 }),
      })
      const j = await r.json()
      const doc = j?.data?.list?.[0] || {}
      const rows = (doc.detail && doc.detail.items) || (doc.detail && doc.detail[String(panelCode).toLowerCase()]) || []
      for (const x of rows) hit.push({ panel: panelCode, id: x.id, 物料类别: x.物料类别 })
    }
    res[code] = hit
  }
  return res
})
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
