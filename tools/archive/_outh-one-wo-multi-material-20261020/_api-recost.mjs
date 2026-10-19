/**
 * _api-recost.mjs — 调「重算成本」(库存三报表的按钮)并打印结果,用来验证
 * inv_cost_ledger 在「同一 (src,rid) 多物料」下水能不能重算。
 * 用法:node _api-recost.mjs [STOCK_LEDGER]
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const panel = process.argv[2] || 'STOCK_LEDGER'

const r0 = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await r0.json())?.data?.token
if (!token) throw new Error('登录失败')

const r = await fetch(`${BASE}/api/px/callButton`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: panel, buttonName: '重算成本', formData: { 开始日期: '2026-09-01', 结束日期: '2026-10-31' } }),
})
const text = await r.text()
console.log(`重算成本 → HTTP ${r.status} ${text.slice(0, 400)}`)
