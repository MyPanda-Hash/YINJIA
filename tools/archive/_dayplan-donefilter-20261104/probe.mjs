/**
 * probe.mjs —— 取证:今日已排/每日已排 是否已排除「已完工 / 已结案」行(2026-11-04)
 *
 * 背景:用户报障「工单排产左侧 未完工量=0,今日已排还有数(服务器 装箱2(新厂) 3046/15000)」。
 *   根因:dayPlanTodayByLine / lineDailyPlan 只过滤了作废/空线,已完工/已结案的行照样参与日计划摊分。
 * 修复:两处查询补 NOT_CLOSED + NOT DONE_ROW(与未交量同口径)。
 *
 * 用法(先起服务,再跑):
 *   node tools/archive/_dayplan-donefilter-20261104/probe.mjs [base]
 *
 * 期望(本地 HSDZ_MES 数据,修复后):
 *   · 装箱2(新厂) 今日已排 = 0        (修复前 = 82,来自已完工+已结案的 GD-2026-09-0164)
 *   · 2号车间  今日已排 = 3555        (未完工行,修复前后一致)
 *   · 1号机    今日已排 = 3090        (未完工行,修复前后一致)
 *   · 装箱2(新厂) scope=全部 的「每日已排」无正值 (修复前 11-04 = 82)
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1) }

async function post(path, body) {
  const r = await (await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })).json()
  if (r?.code !== 200 && r?.code !== 0) throw new Error(path + ' -> ' + JSON.stringify(r).slice(0, 300))
  return r?.data
}

const lines = (await post('/api/px/scheduleBoard/linesSummary', {})) || []
const stats = (await post('/api/px/scheduleBoard/stats', {})) || {}
const dp = (await post('/api/px/scheduleBoard/dayPlan/data', { 生产线: '装箱2(新厂)', scope: '全部' })) || {}

console.log('== 左侧骨架:未交量 / 今日已排 / 日产能 ==')
for (const l of lines) {
  console.log(`  ${String(l['生产线']).padEnd(14)} 未交量=${String(l['未交量']).padStart(8)}  今日已排=${String(l['今日已排']).padStart(8)}  日产能=${String(l['日产能']).padStart(8)}  停用=${l['停用'] ? 'Y' : ''}`)
}
console.log('== 顶部统计 ==')
console.log('  今日超载线数 =', stats['今日超载线数'], ' 今日超额合计 =', stats['今日超额合计'])

const byLine = new Map(lines.map((l) => [String(l['生产线']), l]))
const lineVal = (ln, key) => (byLine.get(ln) || {})[key]
const dpSum = Object.entries(dp['每日已排'] || {}).filter(([, v]) => Number(v) > 0)
console.log('== 装箱2(新厂) scope=全部 的「每日已排」(日期列表头用) ==')
console.log('  日期列 =', (dp['日期'] || []).length, ' 每日已排正值 =', dpSum.length, dpSum.slice(0, 5))

const checks = []
const chk = (name, ok, got) => { checks.push({ name, ok, got }); console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}  (got=${got})`) }

chk('装箱2(新厂) 今日已排 = 0(修复前 82,来自已完工+结案行)', Number(lineVal('装箱2(新厂)', '今日已排') || 0) === 0, lineVal('装箱2(新厂)', '今日已排'))
chk('装箱2(新厂) 未交量 = 0(与该线明细「未完工」为空一致)', Number(lineVal('装箱2(新厂)', '未交量') || 0) === 0, lineVal('装箱2(新厂)', '未交量'))
chk('2号车间 今日已排 = 3555(未完工行,修复前后不变)', Number(lineVal('2号车间', '今日已排') || 0) === 3555, lineVal('2号车间', '今日已排'))
chk('1号机 今日已排 = 3090(未完工行,修复前后不变)', Number(lineVal('1号机', '今日已排') || 0) === 3090, lineVal('1号机', '今日已排'))
chk('装箱2(新厂) 每日已排 无正值(修复前 11-04 = 82)', dpSum.length === 0, dpSum.length)
// 口径一致性:未交量为 0 的线,今日已排也应为 0(前提:没有已入库未结案的在制行)
const bad = lines.filter((l) => Number(l['未交量']) === 0 && Number(l['今日已排']) > 0)
chk('所有「未交量=0」的线 今日已排 也为 0', bad.length === 0, bad.map((l) => l['生产线'] + ':' + l['今日已排']).join(',') || 'none')

const fail = checks.filter((c) => !c.ok)
console.log(`\n== ${checks.length - fail.length}/${checks.length} PASS ==`)
process.exit(fail.length ? 1 : 0)
