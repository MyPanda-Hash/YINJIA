// 只读:在已登录的现场 MES 页面上下文里调面板查询接口,读 MES 侧数量口径。
// 不发任何保存/审核/转ERP 请求。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(async () => {
  const q = async (body) => {
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!j || j.success === false) return { error: j && (j.message || j.msg) || ('HTTP ' + r.status) }
    return j.data || j
  }
  const pick = (row, keys) => {
    const o = {}
    for (const k of keys) if (row[k] !== undefined && row[k] !== null && String(row[k]) !== '') o[k] = row[k]
    return o
  }
  const res = {}
  res.po = await q({ panelCode: 'PU_ORDER', keyword: 'YJ-20261027-05', pageNo: 1, pageSize: 5 })
  res.inByNo = await q({ panelCode: 'PURCHASE_IN', keyword: 'PI-2026-11-0018', pageNo: 1, pageSize: 5 })
  res.inByPo = await q({ panelCode: 'PURCHASE_IN', condition: { 采购订单号: 'YJ-20261027-05' }, pageNo: 1, pageSize: 20 })

  const keys = ['单据编号', '单据日期', '供应商', '供应商编码', '采购订单号', '数量', '实收数量', '计量单位',
    '单价', '金额', '批次号', '源单行号', '采购订单行号', '存货编码', '物料编码', '是否已转ERP', 'ERP单号', '单据状态', '行号']
  const norm = (r) => {
    const hits = pick(r, keys)
    const det = r.detail && (r.detail.items || r.detail)
    if (Array.isArray(det)) hits.lines = det.map((x) => pick(x, keys))
    return hits
  }
  return {
    poTotal: res.po.totalSize, po: (res.po.list || []).map(norm),
    inNoTotal: res.inByNo.totalSize, inNo: (res.inByNo.list || []).map(norm),
    inPoTotal: res.inByPo.totalSize, inPo: (res.inByPo.list || []).map(norm),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/erp-overreceive-20261107/round-02.png' })
