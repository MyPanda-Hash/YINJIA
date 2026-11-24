// round-14 — 看 getFormDescriptor 对「不存在单号」到底返回什么(决定怎么判真伪)
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
async function fd(panelCode, code) {
  const r = await page.fetch(`/api/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(code)}`, {
    headers: { authorization: 'Bearer ' + token }, timeout: 30000,
  })
  const p = JSON.parse(r.body)
  const d = (p && p.data) || {}
  return { status: r.status, keys: Object.keys(d), head: Object.entries(d.data || {}).slice(0, 14), saved: d.data && d.data.saved }
}
console.log(JSON.stringify({
  missing: await fd('QC_INSP', 'IJ-2099-01-9999'),
  voided: await fd('QC_INSP', 'IJ-2026-10-0036'),
  exists: await fd('QC_INSP', 'IJ-2026-10-0020'),
}, null, 2))
