/* 一次性探针:来料检验要求(QC_INSP_REQ)真行 —— 为「带入检验要求」浏览器实测取地面真值
   用法:node tools/archive/_probe-qc-insp-carry/_q-req-rows.mjs */
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
const items = res?.data?.list?.[0]?.detail?.items || []
console.log('要求行总数 =', items.length)
const pick = ['YJ-JB-001', 'YJ-YCYX-006', 'YJ-TS-001', 'YJ-YCYX-008']
for (const code of pick) {
  const row = items.find((r) => String(r['物料编号'] || '').trim() === code)
  if (!row) { console.log(code, '→ (无该物料)'); continue }
  const filled = Object.entries(row).filter(([k, v]) => v !== null && v !== '' && !['id', '物料编号', '物料类别'].includes(k) && !k.startsWith('asp_'))
  console.log(code, '| 类别 =', row['物料类别'], '| 有数据列 =', JSON.stringify(filled))
}
console.log('不在要求表里的物料抽查: YJ-XX-999 →', items.some((r) => String(r['物料编号']).trim() === 'YJ-XX-999'))
