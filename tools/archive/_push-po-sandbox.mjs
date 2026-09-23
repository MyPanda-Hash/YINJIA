// 推送 PI-2026-09-0128(采购订单 YJ-20260909-01 链下)到金蝶测试沙箱
const BASE = 'http://localhost:8090/api'
const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const res = await (await fetch(`${BASE}/px/callButton`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: '转ERP', formData: { 编号: 'PI-2026-09-0128', 单据编号: 'PI-2026-09-0128' }, buttonParam: {} }),
})).json()
console.log(JSON.stringify(res, null, 2))
