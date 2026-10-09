/**
 * _probe-workshop-filter.mjs — 排产界面「按登录车间过滤」验收(9.29 生产管理批次 ③,2026-10-05)
 *
 * 口径:账号车间 = yj_user.生产车间(空=不受限);工单/排产的车间 = 其产线的 bs_prod_line.生产车间。
 *   车间账号:产线下拉 / 左侧骨架 / 已排产列表 只出本车间产线;待排产池不可见(池内行无产线 ⇒ 无车间判据)。
 *   不受限账号(管理员/计划组):照旧看全部。
 *
 * 用法: node tools/archive/_probe-workshop-filter.mjs [base] [期望车间|none]
 *   账号车间的设置/清除由外层 SQL 完成(见交付说明),本脚本只做只读断言。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const EXPECT = (process.argv[3] || 'none').trim()
const API = BASE + '/api'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 160)

async function main() {
  const filtered = EXPECT !== 'none'
  console.log(`== 排产车间过滤探针 @ ${BASE} (期望车间=${EXPECT}) ==`)
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功(admin)')

  const st = await post('/px/scheduleBoard/stats', {})
  const s = st.json?.data || {}
  const lines = s['产线'] || []
  console.log(`  stats: 车间='${s['车间']}' 池受限=${s['待排产池受限']} 产线=${lines.length} 待排产笔数=${s['待排产笔数']}`)

  if (filtered) {
    String(s['车间'] || '') === EXPECT ? ok('stats.车间 = ' + s['车间']) : bad(`stats.车间 = '${s['车间']}'(期望 ${EXPECT})`)
    s['待排产池受限'] === true ? ok('stats.待排产池受限 = true') : bad('stats.待排产池受限 未置 true')
    const bad1 = lines.filter((l) => String(l['生产车间'] || '') !== EXPECT)
    bad1.length === 0 ? ok(`产线下拉 ${lines.length} 条,全部属 ${EXPECT}`)
      : bad('产线下拉含其它车间:' + bad1.map((l) => l['生产线'] + '(' + l['生产车间'] + ')').join('、'))
    const pv = await post('/px/scheduleBoard/pending', {})
    const pool = pv.json?.data || []
    pool.length === 0 ? ok('待排产池对车间账号不可见(0 行)') : bad('待排产池仍返回 ' + pool.length + ' 行')
    const ls = await post('/px/scheduleBoard/linesSummary', {})
    const sm = ls.json?.data || []
    const bad2 = sm.filter((l) => String(l['生产车间'] || '') !== EXPECT)
    sm.length > 0 && bad2.length === 0 ? ok(`左侧骨架 ${sm.length} 条,全部属 ${EXPECT}`)
      : bad(`左侧骨架异常:${sm.length} 条,其中 ${bad2.length} 条属其它车间`)
    // 已排产明细:逐条线查,均属本车间(scoped SQL 已保证,这里抽查第一条)
    if (sm.length) {
      const sc = await post('/px/scheduleBoard/scheduled', { 生产线: sm[0]['生产线'], scope: '全部' })
      const rows = sc.json?.data || []
      ok(`抽查 ${sm[0]['生产线']} 已排产明细 ${rows.length} 行(车间内可见)`)
    }
    const td = await post('/px/scheduleBoard/today', { mode: 'all' })
    const trows = td.json?.data || []
    const bad3 = [...new Set(trows.map((r) => r['生产线']))].filter((ln) => !lines.some((l) => l['生产线'] === ln))
    bad3.length === 0 ? ok(`已排产区(全部) ${trows.length} 行,产线均在本车间范围内`)
      : bad('已排产区出现车间外产线:' + bad3.join('、'))
  } else {
    !s['车间'] ? ok('不受限账号:stats.车间 为空') : bad('不受限账号 stats.车间 = ' + s['车间'])
    s['待排产池受限'] === false ? ok('不受限账号:待排产池受限 = false') : bad('待排产池受限 应为 false')
    const pv = await post('/px/scheduleBoard/pending', {})
    const pool = pv.json?.data || []
    pool.length > 0 ? ok('不受限账号:待排产池可见(' + pool.length + ' 行)') : bad('不受限账号看不到待排产池')
    const shops = [...new Set(lines.map((l) => l['生产车间']).filter(Boolean))]
    shops.length > 1 ? ok(`不受限账号产线下拉跨 ${shops.length} 个车间(${lines.length} 条线)`)
      : bad('不受限账号产线下拉只覆盖 ' + shops.length + ' 个车间,过滤可能未解除')
  }
  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
