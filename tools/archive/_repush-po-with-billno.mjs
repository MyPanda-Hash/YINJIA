// 沙箱验证:采购订单 YJ-20260909-01 弃审→重审→带 bill_no 重推,验证 YJ- 号直落 + 可被源单挂联
const BASE = 'http://localhost:8090/api'
const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const call = async (buttonName, extra = {}) => {
  const res = await (await fetch(`${BASE}/px/callButton`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'PU_ORDER', buttonName, formData: { 编号: 'YJ-20260909-01', ...extra }, buttonParam: {} }),
  })).json()
  console.log(buttonName, '→', JSON.stringify(res.data ?? res.message))
  return res
}
await call('弃审')
await call('审核')
await call('转ERP')
