// 只读:读 送料暂收单/检验单 链路数量 + 生单弹窗元数据里的「超送比例」,确认 MES 侧为何放行 454。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const post = async (path, body) => {
    const r = await fetch('/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    })
    const t = await r.text()
    if (!t) return { error: 'HTTP ' + r.status + ' empty' }
    try { return JSON.parse(t) } catch (e) { return { error: 'non-json ' + t.slice(0, 200) } }
  }
  const keys = ['单据编号', '单据日期', '采购订单号', '采购订单行号', '存货编码', '物料编码', '数量', '送检数量',
    '合格数量', '实收数量', '计量单位', '批次号', '单据状态', '供应商']
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
  for (const [k, panel] of Object.entries({ recv: 'QC_RECV', insp: 'QC_INSP', recvIn: 'QC_RECV' })) {
    const j = await post('/px/queryFormDataList', {
      panelCode: panel, condition: { 采购订单号: 'YJ-20261027-05' }, pageNo: 1, pageSize: 20,
    })
    const d = j.data || {}
    res[k] = { total: d.totalSize, err: j.message, docs: (d.list || []).map(norm) }
  }
  const meta = await post('/px/push/lines', { panelCode: 'PURCHASE_IN', action: '生单', sourceNos: [] })
  res.pushLines = {
    overRatio: meta && meta.data && meta.data.overRatio,
    keys: meta && meta.data ? Object.keys(meta.data) : null,
    err: meta && (meta.message || meta.msg),
  }
  return res
})
console.log(JSON.stringify(out, null, 2))
