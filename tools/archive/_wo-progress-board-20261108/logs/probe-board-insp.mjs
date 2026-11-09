// 第4轮:看板检验状态接口探针(2026-11-08)
const BASE = 'http://127.0.0.1:8090/api'
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body ?? {}) })
  const t = await res.text()
  let j; try { j = JSON.parse(t) } catch { j = { code: -1, message: t.slice(0, 300) } }
  return j
}
const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login?.data?.token
for (const state of ['未完工', '已完工']) {
  const r = await post('/px/workOrderProgress/list', { 状态: state, limit: 30 }, token)
  const d = r?.data
  if (!d) { console.log('[FAIL]', JSON.stringify(r).slice(0, 400)); continue }
  console.log(`\n===== 状态=${state} 汇总=${JSON.stringify(d['汇总'])} =====`)
  for (const row of (d['行'] || []).slice(0, 6)) {
    const steps = (row['工序步骤'] || []).map((s) => {
      const i = s['检验']
      return `${s['工序']}:${s['完工量']}/${s['计划量']}` + (i ? `[检:${i['状态']}${i['提示'] ? '/' + i['提示'] : ''}单${i['单据数']}/审${i['已审核数']}]` : '')
    })
    console.log(`- ${row['工单号']}#${row['工单行号']} 生产状态=${row['生产状态']} 当前工序=${row['当前工序']} 质检状态=${row['质检状态']} 待检验工序=${JSON.stringify(row['待检验工序'])}`)
    console.log(`    步骤: ${steps.join(' | ')}`)
    if (row['质检汇总']) console.log(`    汇总: ${JSON.stringify(row['质检汇总'])}`)
  }
}
// 单行细看
const one = await post('/px/workOrderProgress/list', { 状态: '全部', keyword: 'GD-2026-11-0008' }, token)
console.log('\n===== GD-2026-11-0008 明细 =====')
console.log(JSON.stringify((one?.data?.['行'] || [])[0]?.['工序步骤'], null, 1))
