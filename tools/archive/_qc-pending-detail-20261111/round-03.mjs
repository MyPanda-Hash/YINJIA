/* round-03.mjs — 判定 403 是权限还是 CSRF:同一会话打 3 个面板 + 取 CSRF 元信息 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

const res = await page.evaluate(async () => {
  const out = {}
  const post = async (panelCode) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize: 5 }),
    })
    let t = ''
    try { t = (await r.text()).slice(0, 300) } catch { }
    return { status: r.status, body: t }
  }
  out.insp = await post('QC_INSP')
  out.catalog = await post('QC_CATALOG')
  out.rec = await post('QC_INSP_REC')
  out.detail = await post('QC_INSP_REC_DETAIL')
  out.cookies = document.cookie.split('; ').map((c) => c.split('=')[0])
  return out
})
console.log(JSON.stringify(res, null, 2))
