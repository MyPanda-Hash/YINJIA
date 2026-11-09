// round-05 — 用测试账套(YJ_TEST)登录 + 后端守卫探针(只读:守卫应拒绝,拒绝发生在写库之前)
//   ① /api/auth/login {userName,password,factory} 取 token ② /pending 取一行 ③ /routeSteps 拿工序链+上次产线
//   ④ /preplan 故意传「开工 11-09 / 完工 11-03」(首道,后面道用不存在的线兜底 ⇒ 任何路径都不会写库)
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(4000)

const out = await page.evaluate(async () => {
  const post = async (url, body, token) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}),
    })
    let data = null
    try { data = await r.json() } catch (e) { data = { parseError: String(e) } }
    return { status: r.status, data }
  }
  const loginTest = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  const token = loginTest.data?.data?.token || loginTest.data?.token || null
  if (!token) return { login: loginTest, note: 'YJ_TEST 登录失败,未继续(不拿正式库试写)' }
  localStorage.setItem('mes_token', token)
  const pending = await post('/api/px/scheduleBoard/pending', {}, token)
  const list = pending.data?.data || pending.data || []
  const row = Array.isArray(list) ? list[0] : null
  if (!row) return { login: 'ok', pending: pending.status, note: '测试库待排产池为空,无法做产品守卫探针' }
  const no = row['加工单号']
  const rid = row['行id']
  const rs = await post('/api/px/scheduleBoard/routeSteps', { 加工单号: no, 行id: rid }, token)
  const d = rs.data?.data || {}
  const route = d['工序步骤'] || []
  const lastLines = d['上次产线'] || []
  const lineOf = (op) => (lastLines.find((x) => String(x['工序'] || '').trim() === String(op || '').trim()) || {})['上次生产线'] || ''
  const steps = route.map((s, i) => ({
    工序: s['工序'],
    生产线: i === 0 ? lineOf(s['工序']) : 'NOT-A-LINE-2026',
    计划开工日期: '2026-11-09',
    计划完工日期: i === 0 ? '2026-11-03' : '2026-11-09',
  }))
  const firstLine = steps[0] && steps[0]['生产线']
  if (!firstLine) return { login: 'ok', no, rid, route: route.map((s) => s['工序']), lastLines, note: '首道没有可用的上次产线,未提交' }
  const pre = await post('/api/px/scheduleBoard/preplan', { 加工单号: no, 行id: rid, 步骤: steps }, token)
  return { login: 'ok', factory: 'YJ_TEST', no, rid, ops: route.map((s) => s['工序']), steps, resp: pre }
})
console.log(JSON.stringify(out, null, 2))
