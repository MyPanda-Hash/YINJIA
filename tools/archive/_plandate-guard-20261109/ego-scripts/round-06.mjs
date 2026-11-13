// round-06 — 后端守卫探针(测试账套 YJ_TEST,只读):
//   首道用「该道应进车间」的启用产线 + 故意倒挂日期(开工 11-09 / 完工 11-03),
//   第 2/3 道用不存在的产线兜底 ⇒ 无论守卫是否命中,报错都发生在写库之前。
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
  const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  const token = login.data?.data?.token || login.data?.token || null
  if (!token) return { login, note: 'YJ_TEST 登录失败' }
  const pending = await post('/api/px/scheduleBoard/pending', {}, token)
  const list = pending.data?.data || pending.data || []
  const row = Array.isArray(list) ? list[0] : null
  if (!row) return { note: '测试库待排产池为空' }
  const no = row['加工单号']
  const rid = row['行id']
  const rs = await post('/api/px/scheduleBoard/routeSteps', { 加工单号: no, 行id: rid }, token)
  const d = rs.data?.data || {}
  const route = d['工序步骤'] || []
  const stats = await post('/api/px/scheduleBoard/stats', {}, token)
  const lines = (stats.data?.data || {})['产线'] || []
  const pickLine = (shop) => {
    const hit = lines.find((l) => String(l['生产车间'] || '').trim() === String(shop || '').trim())
    if (hit) return hit['生产线']
    const loose = lines.find((l) => String(l['生产线'] || '').includes('成型'))
    return loose ? loose['生产线'] : ''
  }
  const firstLine = pickLine(route[0] && route[0]['生产车间'])
  const steps = route.map((s, i) => ({
    工序: s['工序'],
    生产线: i === 0 ? firstLine : 'NOT-A-LINE-2026',
    计划开工日期: '2026-11-09',
    计划完工日期: i === 0 ? '2026-11-03' : '2026-11-09',
  }))
  if (!firstLine) return { no, rid, route: route.map((s) => s['工序']), lines: lines.map((l) => [l['生产线'], l['生产车间']]), note: '找不到可用的首道产线' }
  const pre = await post('/api/px/scheduleBoard/preplan', { 加工单号: no, 行id: rid, 步骤: steps }, token)
  return { factory: 'YJ_TEST', no, rid, firstLine, steps, resp: pre }
})
console.log(JSON.stringify(out, null, 2))
