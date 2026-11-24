// round-39 — 复原:把该行数量改回 8000,确认占用/台账一起回去
const BASE = 'http://127.0.0.1:8090'
const DOC = 'SL-2026-11-0002'
const LINE_ID = 552
const QTY = 8000
const task = await taskSpace('batch link qty fix verify')
const page = task.page('p1')
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
const H = { 'content-type': 'application/json', authorization: 'Bearer ' + token }
const r = await page.fetch(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(DOC)}`, { headers: H, timeout: 60000 })
const fd = (JSON.parse(r.body).data) || {}
const tabs = (fd.detail && fd.detail.tabs) || []
const tabKey = (tabs[0] && tabs[0].key) || 'items'
const items = (fd.detailData && (fd.detailData[tabKey] || fd.detailData.items)) || []
const line = items.find((x) => Number(x.id) === LINE_ID)
console.log('复原前 = ' + JSON.stringify({ id: line.id, 数量: line['数量'] }))
line['数量'] = QTY
const formData = Object.assign({}, fd.data, { 编号: fd.data['单据编号'] || DOC, detail: { items } })
const res = await page.fetch('/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'QC_RECV', buttonName: '保存', formData, buttonParam: {} }),
  timeout: 120000,
})
console.log('保存返回 = ' + res.status)
