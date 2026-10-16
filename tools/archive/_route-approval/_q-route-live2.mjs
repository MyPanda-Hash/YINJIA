/* _q-route-live2.mjs — 复核已审核路线能否正常转工单(不应被误拦)。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'HSDZ_MES' }),
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error('login failed')
  return j.data.token
}

;(async () => {
  const tok = await login()
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }

  // 找一行剩余量 > 0 的已审核订单行(且这行**没有**绑定产品路线 —— 由我们在调用时指定已审核路线)
  const pend = await (await fetch(BASE + '/api/px/orderConvert/pending', {
    method: 'POST', headers: H, body: JSON.stringify({ keyword: '', dateFrom: '', dateTo: '' }),
  })).json()
  const rows = (pend.data || []).filter((x) => Number(x.剩余数量) > 0)
  if (!rows.length) { console.log('没有可用订单行，跳过'); return }
  const row = rows[0]

  // 用**已审核**的 GY-CB-STD 转 1 件(最小数量，尽量少造数据)
  console.log(`=== 用已审核路线 GY-CB-STD 转 ${row.订单号}#${row.行id}(生单数量 1)===`)
  const r = await fetch(BASE + '/api/px/orderConvert/toManu', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      rows: [{ 订单号: row.订单号, 行id: row.行id, 生单数量: 1, 工艺路线: 'GY-CB-STD' }],
    }),
  })
  const j = await r.json()
  console.log(`  HTTP ${r.status} → ${JSON.stringify(j.data || j.message)}`)
  console.log(j.code === 200 ? '  ✅ 已审核路线正常放行(闸门没有误拦)' : '  ❌ 已审核路线被误拦，需排查')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
