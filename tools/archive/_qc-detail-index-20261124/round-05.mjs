// round-05 — 直接打后端接口:验证 _docNo 过滤为何 0 行
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
async function q(panelCode, condition, extra) {
  const body = Object.assign({ panelCode, condition, pageNo: 1, pageSize: 5 }, extra || {})
  const r = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 30000,
  })
  let parsed = null
  try { parsed = JSON.parse(r.body) } catch (e) { parsed = r.body.slice(0, 200) }
  const list = parsed && parsed.data && parsed.data.list ? parsed.data.list : (parsed && parsed.list) || []
  return {
    status: r.status,
    total: parsed && (parsed.data ? parsed.data.totalSize : parsed.totalSize),
    keys: list.slice(0, 2).map((d) => Object.keys(d).slice(0, 8)),
    first: list.slice(0, 2).map((d) => ({ 编号: d['编号'], 单据编号: d['单据编号'], 单据日期: d['单据日期'] })),
    msg: parsed && (parsed.msg || parsed.message),
  }
}
const out = {
  insp_docNo: await q('QC_INSP', { _docNo: 'IJ-2026-11-0002' }),
  insp_fieldNo: await q('QC_INSP', { 单据编号: 'IJ-2026-11-0002' }),
  insp_none: await q('QC_INSP', {}),
  rec_docNo: await q('QC_INSP_REC', { _docNo: 'JYSJ-2026-11-0011' }),
  rec_fieldNo: await q('QC_INSP_REC', { 单据编号: 'JYSJ-2026-11-0011' }),
}
console.log(JSON.stringify(out, null, 2))
