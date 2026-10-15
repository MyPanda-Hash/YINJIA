/* _v-recalc-button.cjs — 走应用真实路径验证重算提速(重算成本按钮) */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'
async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json())?.data?.token
  if (!token) { console.log('登录失败'); process.exit(1) }
  for (const p of ['STOCK_LEDGER']) {
    const t = Date.now()
    const r = await fetch(`${BASE}/api/px/callButton`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: p, buttonName: '重算成本', formData: {}, buttonParam: {} }),
      signal: AbortSignal.timeout(300000),
    })
    const txt = await r.text()
    console.log(`${p} 重算成本 → HTTP ${r.status}  ${Date.now() - t} ms  ${txt.slice(0, 200)}`)
    console.log(`   对照:改写前同一条路径 = 137,320~261,877 ms(会锁住三张报表 2~4 分钟)`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
