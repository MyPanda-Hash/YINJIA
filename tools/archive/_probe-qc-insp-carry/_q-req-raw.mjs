/* 一次性探针:QC_INSP_REQ 取数原始形态(排查「0 行」是接口形状还是库真的空)
   用法:node tools/archive/_probe-qc-insp-carry/_q-req-raw.mjs */
const BASE = 'http://127.0.0.1:8090/api'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const res = await (await fetch(`${BASE}/px/queryFormDataList`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'QC_INSP_REQ', pageNo: 1, pageSize: 1, condition: {} }),
})).json()
console.log('顶层键 =', Object.keys(res || {}))
console.log('code/msg =', res?.code, res?.msg)
const d = res?.data
console.log('data 键 =', d && typeof d === 'object' ? Object.keys(d) : typeof d)
const list = d?.list || d?.rows || []
console.log('list 长度 =', list.length)
if (list[0]) {
  console.log('第 0 张键 =', Object.keys(list[0]))
  console.log('detail 键 =', list[0].detail ? Object.keys(list[0].detail) : '(无 detail)')
  console.log('detail.items 长度 =', list[0].detail?.items?.length ?? '(无 items)')
  console.log('样本行 =', JSON.stringify(list[0].detail?.items?.[0] || list[0]).slice(0, 400))
}
console.log('total =', d?.total)
