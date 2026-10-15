/* _v-recalc-test-ledger.cjs — 用测试账套令牌走应用路径重算成本(HSDZ_MES_TEST) */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'
async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const token = (await lr.json())?.data?.token
  if (!token) { console.log('测试账套登录失败'); process.exit(1) }
  console.log('[login] 测试账套 token 已取')
  const t = Date.now()
  const r = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'STOCK_LEDGER', buttonName: '重算成本', formData: {}, buttonParam: {} }),
    signal: AbortSignal.timeout(300000),
  })
  console.log(`重算成本 → HTTP ${r.status}  ${Date.now() - t} ms  ${(await r.text()).slice(0, 200)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
