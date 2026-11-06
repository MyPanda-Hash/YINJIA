const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const r = await window.fetch('/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_INSP_REQ', condition: { 物料编号: 'YJ-XH-001' }, pageNo: 1, pageSize: 1 }),
  })
  const j = await r.json()
  const doc = j?.data?.list?.[0] || {}
  const rows = (doc.detail && doc.detail.items) || []
  const slim = rows.map((x) => {
    const o = {}
    for (const [k, v] of Object.entries(x || {})) {
      if (v === null || v === '' || k.startsWith('asp_')) continue
      o[k] = String(v).slice(0, 60)
    }
    return o
  })
  // 同时把「物料类别」的原始值(含空白)打印出来,避免看着一样其实是脏值
  const cat = rows.map((x) => ({
    id: x.id,
    raw: String(x['物料类别'] ?? ''),
    codes: [...String(x['物料类别'] ?? '')].map((c) => c.codePointAt(0).toString(16)).join(' '),
  }))
  return { count: rows.length, slim, cat }
})
console.log(JSON.stringify(out, null, 2))
