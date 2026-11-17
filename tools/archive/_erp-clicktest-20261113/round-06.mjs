// round-06: 取各出库类单据「已成功转过ERP」的样本,打印表头/行字段(用来造能过金蝶校验的新单)。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const detailRows = async (panel, no) => {
  const res = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 20 })
  for (const d of res.body?.data?.list || []) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === no)
      if (hit.length) return hit
      if (String(d['编号'] || '') === no) return v
    }
  }
  return []
}
const out = {}
for (const panel of ['SALE_OUT', 'MATERIAL_OUT', 'QC_RETURN', 'OTHER_OUT', 'FINISH_IN', 'OTHER_IN']) {
  const r = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, pageNo: 1, pageSize: 60 })
  const list = r.body?.data?.list || []
  const done = list.find((d) => String(d['是否已转ERP'] ?? '') === '是' && String(d['单据状态']) === '已审核')
  if (!done) { out[panel] = { found: false }; continue }
  const rows = await detailRows(panel, String(done['编号']))
  const head = { ...done }
  delete head.detail
  out[panel] = { found: true, no: done['编号'], head, line: rows[0] || null }
  console.log('== ' + panel + ' 样本 ' + done['编号'])
  console.log('   head: ' + JSON.stringify(Object.fromEntries(Object.entries(head).filter(([k, v]) => v !== null && v !== '' && !['detail', '编号'].includes(k)))).slice(0, 700))
  console.log('   line: ' + JSON.stringify(Object.fromEntries(Object.entries(rows[0] || {}).filter(([k, v]) => v !== null && v !== ''))).slice(0, 900))
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-06.json', JSON.stringify(out, null, 2), 'utf8')
