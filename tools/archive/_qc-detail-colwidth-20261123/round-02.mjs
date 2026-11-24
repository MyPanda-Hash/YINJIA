// round-02: 取明细表前 300 行,统计每列内容的最长显示宽度(用于定列宽/上限)
const task = await taskSpace('qc-detail-expand-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 30000 })
await page.waitForTimeout(3500)

const res = await page.evaluate(async () => {
  const tk = localStorage.getItem('token') || JSON.parse(localStorage.getItem('mes') || '{}')?.token
  const call = async (n) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) },
      body: JSON.stringify({ panelCode: 'QC_PROC_INSP_DETAIL', pageNo: n, pageSize: 500 }),
    })
    const j = await r.json()
    return j
  }
  const j = await call(1)
  const data = j?.data || j
  const rows = data?.list || data?.rows || data?.records || []
  const keys = Object.keys(rows[0] || {})
  const px = (s) => {
    let w = 0
    for (const ch of String(s)) w += /[\u1100-\uffff]/.test(ch) ? 12 : 6.6
    return Math.round(w)
  }
  const stats = keys.map((k) => {
    let max = 0
    let sample = ''
    for (const r of rows) {
      const v = r[k]
      if (v === null || v === undefined || v === '') continue
      const w = px(v)
      if (w > max) { max = w; sample = String(v) }
    }
    return { key: k, maxPx: max, sample, maxChars: sample.length }
  })
  return { total: data?.total, rowCount: rows.length, stats, firstRow: rows[0] }
})
console.log(JSON.stringify(res, null, 2))
await task.finish({ keep: [] })
