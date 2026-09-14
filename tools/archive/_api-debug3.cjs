/**
 * _api-debug3.cjs — 确认 getFormDescriptor 完整结构(明细 items 是否返回)
 */
const BASE = 'http://localhost:8090/api'
async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}
async function main() {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = login.json.data.token
  const m1 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const mno = m1.json?.data?.['编号']
  const m2 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: { 编号: mno, '测试主题': '矿化测试', detail: { items: [
    { '指标': '锶 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.47', '浸泡30min煮沸晾凉': '2.74' },
    { '指标': 'PH', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '6.84', '浸泡30min': '7.2', '浸泡30min煮沸晾凉': '7.86' },
  ] } }, buttonParam: {} }, token)
  console.log('SAVE:', m2.status)
  const rb = await api('GET', '/px/getFormDescriptor?panelCode=RD_MINERAL&code=' + encodeURIComponent(mno), null, token)
  const inner = rb.json?.data?.data
  console.log('INNER KEYS:', inner ? Object.keys(inner).join(',') : '(none)')
  console.log('INNER DETAIL:', JSON.stringify(inner?.detail))
  const items = inner?.detail?.items || []
  console.log('ITEMS:', items.length, items.length ? JSON.stringify(items[0]) : '')
  // 列表查询(首页形态)
  const list = await api('POST', '/px/queryFormDataList', { panelCode: 'RD_MINERAL', condition: {}, pageNo: 1, pageSize: 5 }, token)
  console.log('LIST RAW:', list.text.slice(0, 300))
  await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '删除', formData: { 编号: mno }, buttonParam: {} }, token)
  console.log('CLEANED, mno=', mno)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
