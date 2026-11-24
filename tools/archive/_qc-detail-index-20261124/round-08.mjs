// round-08 — getFormDescriptor 直查 IJ-2026-11-0002 / JYSJ-2026-11-0011,判断单据是否真存在
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
async function fd(panelCode, code) {
  const r = await page.fetch(`/api/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(code)}`, {
    headers: { authorization: 'Bearer ' + token },
    timeout: 30000,
  })
  let p = null
  try { p = JSON.parse(r.body) } catch (e) { p = String(r.body).slice(0, 200) }
  const d = (p && p.data) || p
  return {
    status: r.status,
    ok: !!(p && (p.code === 0 || p.success === true || p.data)),
    msg: p && (p.msg || p.message),
    headKeys: d && d.data ? Object.entries(d.data).slice(0, 12) : (typeof d === 'string' ? d : undefined),
    status2: d && d.data ? d.data['状态'] || d.data['单据状态'] : undefined,
  }
}
console.log(JSON.stringify({
  insp_missing: await fd('QC_INSP', 'IJ-2026-11-0002'),
  insp_existing: await fd('QC_INSP', 'IJ-2026-11-0005'),
  rec: await fd('QC_INSP_REC', 'JYSJ-2026-11-0011'),
}, null, 2))
