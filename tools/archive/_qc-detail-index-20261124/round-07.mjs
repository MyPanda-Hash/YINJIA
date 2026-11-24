// round-07 — 对照:检验单列表 vs 检验数据记录引用的检验单号,找孤儿引用
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
async function q(panelCode, condition, pageSize, pageNo) {
  const r = await page.fetch('/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: condition || {}, pageNo: pageNo || 1, pageSize: pageSize || 200 }),
    timeout: 40000,
  })
  const p = JSON.parse(r.body)
  const d = p.data || p
  return { total: d.totalSize, list: d.list || [] }
}
const insp = await q('QC_INSP', {}, 200)
const inspNos = insp.list.map((d) => d['编号'] || d['单据编号'])
const inspSet = new Set(inspNos)
const rec = await q('QC_INSP_REC', {}, 200)
const recRefs = rec.list.map((d) => d['来料检验单号']).filter(Boolean)
const missing = [...new Set(recRefs.filter((no) => !inspSet.has(String(no).trim())))]
console.log(JSON.stringify({
  inspTotal: insp.total,
  inspNos,
  recTotal: rec.total,
  recRefsSample: recRefs.slice(0, 12),
  missingFromInspList: missing,
}, null, 2))
