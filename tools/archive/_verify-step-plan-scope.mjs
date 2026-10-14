/*
 * _verify-step-plan-scope.mjs — 工序计划量的换算口径一致(2026-10-15)
 *
 * 【用户报障】工序进度里「成型 / 切炭 / 组装」三道全显示 0/8400,而本行排产数量只有 1200
 *   ——「这里的数量也对不上」。
 *
 * 【根因】同一条路线的工序计划量有**两套算法**:
 *   · 快速排产 ProcessTaskService.routeSteps / 报工封顶 WoReportService:各工序**独立**折算
 *     = 本行排产数量 × **该道自己**的换算率(用户口径 2026-10-07「各个工序的换算率分开算」);
 *   · 追溯工序进度 ProcessTaskService.detail:**逐道累乘**(2026-10-05 旧口径,没跟上)
 *     = 首道 基数×率,其后 上一道×率。
 *   实测 fixture MO-2026-10-0004 行3(排产 1200,路线 GY-CB-STD:成型换算率 7、切炭/组装 1):
 *     独立 → 成型 8400 / 切炭 1200 / 组装 1200;累乘 → 8400 / 8400 / 8400(用户看到的)。
 *
 * 【验什么】
 *   ① detail 每道计划量 = 本行排产 × 该道换算率(逐道独立,不累乘);
 *   ② detail 与 routeSteps 逐道计划量**完全一致**(同一路线不允许两套数);
 *   ③ fixture 具体值:成型 8400、切炭 1200、组装 1200(而不是三道全 8400)。
 *
 * 只读接口。用法: node tools/archive/_verify-step-plan-scope.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-10-0004'
const XC = 3
const EXPECT = { 成型: 8400, 切炭: 1200, 组装: 1200 }   // GY-CB-STD 成型换算率 7、其余 1;本行排产 1200
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())

const list = await api('/px/workOrderList', { keyword: WO })
const row = (list.data || []).find((r) => Number(r['工单行号']) === XC)
console.log(`fixture ${WO} 行${XC}: 行id=${row?.['行id']} 排产数量=${row?.['排产数量']}`)
ok(`① 找到 fixture 行(${WO}#${XC})`, !!row, JSON.stringify((list.data || []).map((r) => r['工单行号'])))
if (!row) process.exit(1)
const plan = Number(row['排产数量'])

const detail = (await api('/px/processTask/detail', { 工单号: WO, 工单行id: row['行id'] })).data || {}
const route = (await api('/px/scheduleBoard/routeSteps', { 加工单号: WO, 行id: row['行id'] })).data || {}
const dSteps = detail['工序步骤'] || []
const rSteps = route['工序步骤'] || []
console.log(`    工序进度(detail)   = ${JSON.stringify(dSteps.map((s) => [s['工序'], s['计划量'], '率' + s['换算率']]))}`)
console.log(`    快速排产(routeSteps)= ${JSON.stringify(rSteps.map((s) => [s['工序'], s['计划数量']]))}`)

// ① 逐道独立折算
for (const s of dSteps) {
  const rate = Number(s['换算率'] || 1) || 1
  const want = Math.round(plan * rate * 10000) / 10000
  const got = Number(s['计划量'])
  ok(`① ${s['工序']} 计划量 = 本行排产 ${plan} × 换算率 ${rate} = ${want}`,
    Math.abs(got - want) < 0.01, `实际 ${got}`)
}

// ② 两条路径逐道一致
const rMap = new Map(rSteps.map((s) => [String(s['工序']), Number(s['计划数量'])]))
for (const s of dSteps) {
  const a = Number(s['计划量']), b = rMap.get(String(s['工序']))
  ok(`② ${s['工序']} 两个接口计划量一致(工序进度 ${a} = 快速排产 ${b})`,
    b !== undefined && Math.abs(a - b) < 0.01, `detail=${a} routeSteps=${b}`)
}

// ③ fixture 具体值(用户截图里三道全是 8400 的那个 bug)
for (const [op, want] of Object.entries(EXPECT)) {
  const s = dSteps.find((x) => String(x['工序']) === op)
  ok(`③ ${op} 计划量 = ${want}(不是累乘后的 8400)`, s && Math.abs(Number(s['计划量']) - want) < 0.01,
    s ? String(s['计划量']) : '(缺该道)')
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
