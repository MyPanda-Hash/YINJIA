/**
 * _api-cleanup-picks.mjs — 清理探针领料单(测试账套):弃审 → 删除 → 回写应随之清空
 * 用法:node tools/archive/_picking-flow-20261018/_api-cleanup-picks.mjs CL-2026-10-0070 CL-2026-10-0071
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const nos = process.argv.slice(2)

const r0 = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await r0.json())?.data?.token
if (!token) throw new Error('登录失败')
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()

for (const no of nos) {
  const u = await post('/api/px/callButton', { panelCode: 'MATERIAL_OUT', buttonName: '弃审', formData: { 单据编号: no, 编号: no } })
  console.log(`弃审 ${no} → ${JSON.stringify(u?.data || u?.message || '').slice(0, 120)}`)
  const d = await post('/api/px/deleteForms', { panelCode: 'MATERIAL_OUT', rowCodes: [no] })
  console.log(`删除 ${no} → ${JSON.stringify(d?.data ?? d?.message ?? '').slice(0, 120)}`)
}
