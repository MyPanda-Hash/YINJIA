// 只读:确认这张入库单/订单的单据状态与转ERP 标记(失败后应仍为「否」,可直接重试)。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2500)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const q = async (body) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    const t = await r.text()
    if (!t) return { error: 'HTTP ' + r.status + ' empty' }
    try { return JSON.parse(t) } catch (e) { return { error: 'non-json ' + t.slice(0, 200) } }
  }
  const keys = ['单据编号', '单据状态', '是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间', '采购订单号', '批次号']
  const pick = (row) => {
    const o = {}
    for (const k of keys) if (row[k] !== undefined && row[k] !== null && String(row[k]) !== '') o[k] = row[k]
    return o
  }
  const r1 = await q({ panelCode: 'PURCHASE_IN', keyword: 'PI-2026-11-0018', pageNo: 1, pageSize: 3 })
  const r2 = await q({ panelCode: 'PU_ORDER', keyword: 'YJ-20261027-05', pageNo: 1, pageSize: 3 })
  return {
    inErr: r1.message, in: ((r1.data || {}).list || []).map(pick),
    poErr: r2.message, po: ((r2.data || {}).list || []).map(pick),
  }
})
console.log(JSON.stringify(out, null, 2))
