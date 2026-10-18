/**
 * _api-audit-picks.mjs — 探针:审核两张探针领料单(测试账套),验证「一单多张」回写 ll_no2
 * 用法:node tools/archive/_picking-flow-20261018/_api-audit-picks.mjs CL-2026-10-0070 CL-2026-10-0071
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const nos = process.argv.slice(2)

const r0 = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await r0.json())?.data?.token
if (!token) throw new Error('登录失败')

for (const no of nos) {
  const r = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'MATERIAL_OUT', buttonName: '审核', formData: { 单据编号: no, 编号: no } }),
  })
  const j = await r.json()
  console.log(`${no} → HTTP ${r.status} ${JSON.stringify(j?.data || j?.message || '').slice(0, 200)}`)
}
