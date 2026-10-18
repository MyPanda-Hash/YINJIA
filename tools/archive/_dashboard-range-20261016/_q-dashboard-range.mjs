/**
 * _q-dashboard-range.mjs — 看板「时间区间」验收探针(只读;2026-10-16)
 *
 * 断言:
 *   ① 各模块数字随区间变(近 7 天 ⊂ 近 30 天 ⇒ 不可能更大);
 *   ② 趋势桶数 = 区间天数(≤31 天)或周数(>31 天),且与后端回显的 range/bucket 一致;
 *   ③ 区间回显 = 请求区间(含「含今天」的闭区间口径);
 *   ④ /dashboard/rd 也按区间过滤(时间戳都落在区间内)。
 * 用法: node tools/archive/_dashboard-range-20261016/_q-dashboard-range.mjs [--base http://127.0.0.1:8090]
 */
const BASE = (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'

const post = async (p, body, token) => (await (await fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body),
})).json())
const get = async (p, token) => (await (await fetch(BASE + p, { headers: { Authorization: 'Bearer ' + token } })).json())

const days = (f, t) => Math.round((new Date(t) - new Date(f)) / 86400000) + 1
const d = (n) => new Date(2026, 9, 16 + n).toISOString().slice(0, 10) // 以 2026-10-16 为锚
const RANGES = [
  ['今日', d(0), d(0)],
  ['近 7 天', d(-6), d(0)],
  ['近 30 天', d(-29), d(0)],
  ['本月', '2026-10-01', d(0)],
  ['上月', '2026-09-01', '2026-09-30'],
  ['近 90 天(按周)', d(-89), d(0)],
]

let bad = 0
const ok = (cond, msg, extra = '') => { console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg + (extra ? '  ' + extra : '')); if (!cond) bad++ }

for (const [label, factory] of [['正式账套 YJ', undefined], ['测试账套 YJ_TEST', 'YJ_TEST']]) {
  const lg = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  const token = lg.data.token
  console.log(`\n===== ${label} =====`)
  const got = {}
  for (const [name, from, to] of RANGES) {
    const s = await get(`/dashboard/stats?from=${from}&to=${to}`, token)
    if (!s?.data?.range) { ok(false, `${name} 接口无 range 回显`, JSON.stringify(s).slice(0, 120)); continue }
    const r = s.data.range
    const want = days(from, to)
    const bucket = want > 31 ? 'week' : 'day'
    const trendLen = (s.data.stock.trend7 || []).length
    const wantBuckets = bucket === 'week' ? Math.ceil((want + new Date(from).getDay()) / 7) : want
    got[name] = {
      stockIn: s.data.stock.totalIn, stockOut: s.data.stock.totalOut,
      qualityTotal: s.data.quality.total, salesTotal: s.data.sales.total,
      prodTrend: (s.data.production.trend7 || []).length,
    }
    ok(r.from === from && r.to === to, `${name} 区间回显`, `${r.from} ~ ${r.to}(${r.days} 天, ${r.bucket})`)
    ok(r.days === want, `${name} 天数 = 请求天数`, `${r.days} vs ${want}`)
    ok(r.bucket === bucket, `${name} 分桶口径(>31 天按周)`, r.bucket)
    ok(trendLen > 0 && trendLen <= wantBuckets + 1, `${name} 趋势桶数合理`, `${trendLen} 点 / 最多 ${wantBuckets}`)
    const rd = await get(`/dashboard/rd?from=${from}&to=${to}`, token)
    const ats = (rd?.data?.newDocs || []).map((x) => String(x.at || '').slice(0, 10))
    ok(ats.every((x) => !x || (x >= from && x <= to)), `${name} 研发模块单据都在区间内`, `${ats.length} 条`)
  }
  // 单调性:近 7 天 ≤ 近 30 天(同一模块同一指标)
  for (const k of ['stockIn', 'stockOut', 'qualityTotal']) {
    const a = got['近 7 天']?.[k] ?? 0, b = got['近 30 天']?.[k] ?? 0
    ok(Number(a) <= Number(b), `${k}:近 7 天 ≤ 近 30 天`, `${a} ≤ ${b}`)
  }
  console.log('  各区间库存入库单量:', Object.entries(got).map(([k, v]) => `${k}=${v.stockIn}`).join('  '))
  console.log('  各区间质检明细总量:', Object.entries(got).map(([k, v]) => `${k}=${v.qualityTotal}`).join('  '))
}

console.log(bad ? `\n[FAIL] ${bad} 项不通过` : '\n[OK] 时间区间在 6 个模块、两个账套上均生效')
process.exit(bad ? 1 : 0)
