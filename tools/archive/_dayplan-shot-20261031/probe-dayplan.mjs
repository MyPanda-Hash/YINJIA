/**
 * probe-dayplan.mjs —— 复核「生产工单」页日排产日期列(2026-10-31 日期列语义补丁)
 *
 * 用法: node probe-dayplan.mjs [base]
 * 验证点:
 *   1. 过去日期「有计划」也出列(GD-2026-10-0227 行1 的 10-29/10-30 各 2000 不再被吞);
 *   2. 7天已排/15天已排 与「出列格子里能看到的计划量」对得上。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1) }

/** 与截图同一页(日期范围 2026-10-17~10-31 命中的那 13 行) */
const IDS = [2179, 2178, 2177, 2176, 2175, 2174, 2173, 2172, 2171, 1171, 1170, 1169, 1168]

const res = await (await fetch(BASE + '/api/px/scheduleBoard/dayPlan/data', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ 行id列表: IDS }),
})).json()
const data = res?.data || {}
const dates = data['日期'] || []
console.log('今天 =', data['今天'])
console.log('日期列 =', dates.join(' '))
console.log('')

const FAKE_NO = { 2179: 'GD-2026-10-0231', 2178: 'GD-2026-10-0230', 2177: 'GD-2026-10-0229', 2176: 'GD-2026-10-0228',
  2175: 'GD-2026-10-0227', 2174: 'GD-2026-10-0227', 2173: 'GD-2026-10-0226-1', 2172: 'GD-2026-10-0227',
  2171: 'GD-2026-10-0226', 1171: 'GD-2026-10-0225', 1170: 'GD-2026-10-0202', 1169: 'GD-2026-10-0224', 1168: 'GD-2026-10-0223' }
console.log('行id | 工单 | 7天已排 | 15天已排 | 格子计划合计 | 对得上? | 计划明细')
for (const r of data['行'] || []) {
  const plan = r['日计划'] || {}
  const shown = Object.values(plan).reduce((a, b) => a + Number(b || 0), 0)
  const visible = Object.entries(plan).map(([d, v]) => `${d.slice(5)}:${v}`).join(' ')
  // 只比「出列日期里 ≤ 今天+7」的部分(7天已排 的窗口口径),两者应完全一致
  const todayStr = data['今天']
  const d7 = new Date(todayStr + 'T00:00:00Z'); d7.setUTCDate(d7.getUTCDate() + 7)
  const d7s = d7.toISOString().slice(0, 10)
  const shown7 = Object.entries(plan).filter(([d]) => d <= d7s).reduce((a, [, v]) => a + Number(v || 0), 0)
  const ok = Math.abs(shown7 - Number(r['7天已排'] || 0)) < 1e-6 ? 'OK' : `❌ 差${(Number(r['7天已排'] || 0) - shown7).toFixed(2)}`
  console.log(`${r['行id']} | ${FAKE_NO[r['行id']] || ''} | ${r['7天已排']} | ${r['15天已排']} | ${shown} | ${ok} | ${visible || '(空)'}`)
}
console.log('\n报工(格下小字,只读)非空的行:')
for (const r of data['行'] || []) {
  const act = r['日报工'] || {}
  if (Object.keys(act).length) console.log('  ', r['行id'], FAKE_NO[r['行id']] || '', JSON.stringify(act))
}
