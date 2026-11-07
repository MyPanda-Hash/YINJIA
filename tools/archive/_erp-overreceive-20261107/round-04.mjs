// 只读:带 localStorage.mes_token 调面板查询接口,读 MES 侧采购订单/采购入库单口径。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(3000)

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
    let j
    try { j = JSON.parse(t) } catch (e) { return { error: 'non-json: ' + t.slice(0, 200) } }
    if (j.success === false) return { error: j.message || j.msg || 'fail' }
    return j.data || j
  }
  const keys = ['单据编号', '单据日期', '供应商', '供应商编码', '采购订单号', '数量', '实收数量', '计量单位',
    '单价', '金额', '批次号', '源单行号', '采购订单行号', '存货编码', '物料编码', '是否已转ERP', 'ERP单号', '行号']
  const pick = (row) => {
    const o = {}
    for (const k of keys) if (row[k] !== undefined && row[k] !== null && String(row[k]) !== '') o[k] = row[k]
    return o
  }
  const norm = (row) => {
    const o = pick(row)
    const det = row.detail && (row.detail.items || row.detail)
    if (Array.isArray(det)) o.lines = det.map(pick)
    return o
  }
  const res = {}
  res.po = await q({ panelCode: 'PU_ORDER', keyword: 'YJ-20261027-05', pageNo: 1, pageSize: 5 })
  res.inNo = await q({ panelCode: 'PURCHASE_IN', keyword: 'PI-2026-11-0018', pageNo: 1, pageSize: 5 })
  res.inByPo = await q({ panelCode: 'PURCHASE_IN', condition: { 采购订单号: 'YJ-20261027-05' }, pageNo: 1, pageSize: 20 })
  return {
    poTotal: res.po.error || res.po.totalSize, po: (res.po.list || []).map(norm), poErr: res.po.error,
    inNoTotal: res.inNo.error || res.inNo.totalSize, inNo: (res.inNo.list || []).map(norm), inNoErr: res.inNo.error,
    inPoTotal: res.inByPo.error || res.inByPo.totalSize, inPo: (res.inByPo.list || []).map(norm), inPoErr: res.inByPo.error,
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/erp-overreceive-20261107/round-04.png' })
