const BASE = 'http://127.0.0.1:8090/api'
const post = async (p, body, token) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => null) }
}
for (const [label, factory] of [['正式账套 YJ', undefined], ['测试账套 YJ_TEST', 'YJ_TEST']]) {
  const lg = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  const token = lg.json.data.token
  const s = await (await fetch(BASE + '/dashboard/stats', { headers: { Authorization: 'Bearer ' + token } })).json()
  const st = s.data.stock
  const p7 = st.trend7.reduce((a, x) => a + x.added + x.done, 0)
  console.log(`[${label}] 入库 ${st.totalIn} 单 / 出库 ${st.totalOut} 单 / 明细 ${st.totalLines} 行 / 近7天趋势点数合计 ${p7} / 现存量TOP ${(st.topItems || []).length} 条`)
  for (const p of ['STOCK_LEDGER', 'STOCK_BALANCE', 'STOCK_STATUS', 'STOCK_SUMMARY']) {
    const q = await post('/px/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 1, condition: {} }, token)
    process.stdout.write(`${p}:${q.json?.data?.totalSize ?? '?'}  `)
  }
  console.log('')
}
