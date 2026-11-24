// round-09 — 看有没有「已作废/已删除单据」可查的面板(给跳空表一个去处)
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
async function q(panelCode, condition, pageSize) {
  const r = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: condition || {}, pageNo: 1, pageSize: pageSize || 20 }),
    timeout: 30000,
  })
  const p = JSON.parse(r.body)
  const d = p.data || p
  return { total: d.totalSize, list: (d.list || []).slice(0, 5).map((x) => x['编号'] || x['单据编号']) , msg: p.msg }
}
console.log(JSON.stringify({
  status_panel: await q('DOC_STATUS'),
  qc_insp_canceled_like: await q('QC_INSP', { 单据编号: 'IJ-2026-11-0002' }),
}, null, 2))
