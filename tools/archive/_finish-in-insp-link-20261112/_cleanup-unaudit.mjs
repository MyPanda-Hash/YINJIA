// 还原:两张检验单弃审回草稿(门禁验证时临时审核过)
const BASE = 'http://127.0.0.1:8090/api'
const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const call = (panelCode, buttonName, formData) => fetch(`${BASE}/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((r) => r.json())
for (const [panel, code] of [['QC_ASM_INSP', 'ZJ-2026-10-0135'], ['QC_PROC_INSP', 'ZC-2026-10-0126']]) {
  const r = await call(panel, '弃审', { 编号: code })
  console.log(panel + '=' + JSON.stringify({ code: r.code, msg: r.message }))
}
