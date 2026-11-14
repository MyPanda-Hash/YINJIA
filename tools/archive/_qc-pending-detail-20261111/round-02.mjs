/* round-02.mjs — 直接打接口看后端返回(0 条的原因) */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

const body = { panelCode: 'QC_INSP_REC_DETAIL', condition: {}, keyword: '', pageNo: 1, pageSize: 50 }
const res = await page.evaluate(async (b) => {
  const r = await fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(b),
  })
  const text = await r.text()
  return { status: r.status, text: text.slice(0, 1500) }
}, body)
console.log('queryFormDataList ->', JSON.stringify(res, null, 2))

// 面板配置(看字段/查询字段/页大小有没有下发)
const cfg = await page.evaluate(async () => {
  const r = await fetch('/api/px/getPanelConfig?panelCode=QC_INSP_REC_DETAIL', { credentials: 'include' })
  const j = await r.json().catch(() => null)
  const md = j?.data?.metadata || {}
  const tp = md?.panelPageDto?.tablePages?.[0] || {}
  return {
    status: r.status,
    panelName: md.panelName,
    report: md.panelCategory,
    pageSize: tp.pageSize,
    queryFields: (tp.queryFields || []).map((f) => f.dataName),
    columns: (tp.gridTabs?.[0]?.columns || []),
  }
})
console.log('panelConfig ->', JSON.stringify(cfg, null, 2))
