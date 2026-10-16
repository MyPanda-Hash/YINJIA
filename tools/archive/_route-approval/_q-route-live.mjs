/* _q-route-live.mjs — 复核 8090 上线版本:登录 → 调 routes/pending,核对工艺路线审核闸门。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'HSDZ_MES' }),
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 200))
  return j.data.token
}

;(async () => {
  const tok = await login()
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }

  let r = await fetch(BASE + '/api/px/processTask/routes', { method: 'POST', headers: H, body: '{}' })
  const routes = (await r.json()).data || []
  console.log('=== /api/px/processTask/routes(弹窗数据源) ===')
  for (const x of routes) console.log(`  ${x.编码}\t${x.审核状态}\t${x.名称}\t${x.工序数}道\t${x.工序序列}`)

  r = await fetch(BASE + '/api/px/orderConvert/pending', {
    method: 'POST', headers: H,
    body: JSON.stringify({ keyword: '', dateFrom: '', dateTo: '' }),
  })
  const pending = (await r.json()).data || []
  console.log(`\n=== /api/px/orderConvert/pending(${pending.length} 行)前 5 行 ===`)
  for (const x of pending.slice(0, 5)) console.log(`  ${x.订单号}#${x.行号}\t路线=${x.工艺路线 || '-'}\t${x.路线审核状态}`)

  console.log('\n=== 预期 ===')
  console.log('  · GY-CB-STD 应 已审核(存量基线补过)')
  console.log('  · GY-001/002/003、GY-2026-10-0001/0004 应 未审核(没投产,不补基线)')

  // ② 实调 toManu:未审核路线必须被拒，已审核路线必须放行(两条都用真实订单行)
  console.log('\n=== /api/px/orderConvert/toManu 实调(校验 requireRouteAudited)===')

  // 2a. 拿一行已审核、剩余量 > 0 的订单行当载体
  const row = pending.find((x) => Number(x.剩余数量) > 0)
  if (!row) {
    console.log('  (没有可用的已审核订单行，跳过实调)')
  } else {
    // 2b. 未审核路线 → 期望 400 且消息含「尚未审核」
    for (const bad of ['GY-001', 'GY-2026-10-0004']) {
      try {
        const rr = await fetch(BASE + '/api/px/orderConvert/toManu', {
          method: 'POST', headers: H,
          body: JSON.stringify({ rows: [{ 订单号: row.订单号, 行id: row.行id, 工艺路线: bad }] }),
        })
        const j = await rr.json()
        console.log(`  ${bad} → HTTP ${rr.status} ${j.message}`)
      } catch (e) { console.log(`  ${bad} → 请求异常 ${e.message}`) }
    }

    // 2c. 空路线 → 期望 400(未选择)
    try {
      const rr = await fetch(BASE + '/api/px/orderConvert/toManu', {
        method: 'POST', headers: H,
        body: JSON.stringify({ rows: [{ 订单号: row.订单号, 行id: row.行id }] }),
      })
      const j = await rr.json()
      console.log(`  (空路线) → HTTP ${rr.status} ${j.message}`)
    } catch (e) { console.log(`  (空路线) → 请求异常 ${e.message}`) }
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

