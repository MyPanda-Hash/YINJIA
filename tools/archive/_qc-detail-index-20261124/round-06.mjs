// round-06 — 带 Bearer 打后端接口:验证 _docNo 过滤为何 0 行
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
async function q(panelCode, condition, extra) {
  const body = Object.assign({ panelCode, condition, pageNo: 1, pageSize: 5 }, extra || {})
  const r = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    timeout: 30000,
  })
  let p = null
  try { p = JSON.parse(r.body) } catch (e) { p = String(r.body).slice(0, 300) }
  const d = p && p.data ? p.data : p
  const list = (d && d.list) || []
  return {
    status: r.status,
    total: d && d.totalSize,
    firstNos: list.slice(0, 3).map((x) => [x['编号'], x['单据编号'], x['单据日期'], x['明细'] ? 'hasDetail' : '']),
    msg: p && (p.msg || p.message || p.error),
    rawHead: typeof p === 'string' ? p : undefined,
  }
}
const out = {
  insp_docNo: await q('QC_INSP', { _docNo: 'IJ-2026-11-0002' }),
  insp_fieldNo: await q('QC_INSP', { 单据编号: 'IJ-2026-11-0002' }),
  insp_plain: await q('QC_INSP', {}),
  rec_docNo: await q('QC_INSP_REC', { _docNo: 'JYSJ-2026-11-0011' }),
  rec_plain: await q('QC_INSP_REC', {}),
  cat_plain: await q('QC_CATALOG', {}),
}
console.log(JSON.stringify(out, null, 2))
