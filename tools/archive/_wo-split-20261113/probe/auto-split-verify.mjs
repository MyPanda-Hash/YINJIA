// 2026-11-13 第五轮:排产数量 < 需求数量 ⇒ 剩余自动切单 接口验收探针
// 前置:先执行 .tmp/_q/fixture-auto-split.sql(测试账套),再跑本脚本;跑完执行 cleanup 脚本。
// 用法: node tools/archive/_wo-split-20261113/probe/auto-split-verify.mjs [baseUrl]
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const results = []
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) })
  const txt = await res.text()
  let json
  try { json = JSON.parse(txt) } catch { throw new Error(`${path} HTTP ${res.status} 非 JSON: ${txt.slice(0, 300)}`) }
  return { http: res.status, code: json.code, message: json.message, data: json.data }
}
const post = (p, b, t) => call('POST', p, b, t)

const login = (await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })).data
const token = login.token
if (!token) throw new Error('登录失败')
console.log('login OK, base=' + BASE)

// 夹具行(按工单号查列表拿 行id)
const rows = (await post('/api/px/workOrderList', { keyword: 'GD-VERIFY-SPLIT-' }, token)).data || []
const p1 = rows.find((r) => r['工单号'] === 'GD-VERIFY-SPLIT-01')
const p2 = rows.find((r) => r['工单号'] === 'GD-VERIFY-SPLIT-02')
ok('夹具存在(GD-VERIFY-SPLIT-01/02)', !!p1 && !!p2, `p1=${p1?.['行id']} 需求=${p1?.['需求数量']} p2=${p2?.['行id']}`)

// 路线步骤(取工序 + 选线)
async function routeSteps(row) {
  const rs = (await post('/api/px/scheduleBoard/routeSteps', { 加工单号: row['工单号'], 行id: row['行id'] }, token)).data || {}
  const steps = (rs['工序步骤'] || []).map((s) => ({ 工序: s['工序'], 生产车间: s['生产车间'] }))
  return { rs, steps }
}
const { rs: rs1, steps: st1 } = await routeSteps(p1)
ok('路线步骤可读(GY-CB-STD)', st1.length === 3, JSON.stringify(st1))
const lineOf = { 成型: '成型1线', 切炭: '切炭2(自动)', 组装: '组装线' }
const steps1 = st1.map((s) => ({ 工序: s.工序, 生产线: lineOf[s.工序] }))

// ① 排产 60(< 需求 100) ⇒ 自动切出 40
const pre1 = await post('/api/px/scheduleBoard/preplan', {
  加工单号: p1['工单号'], 行id: p1['行id'], 排产数量: 60, 步骤: steps1,
}, token)
const d1 = pre1.data || {}
ok('① 排产成功且返回自动切单信息', pre1.code === 200 && Number(d1['排产数量']) === 60 && !!d1['自动切出子工单'],
  `code=${pre1.code} 排产=${d1['排产数量']} 子单=${d1['自动切出子工单']} 剩余=${d1['自动切出数量']}`)
const childNo = d1['自动切出子工单'] || ''
ok('① 自动切出数量=40', Number(d1['自动切出数量']) === 40, `自动切出=${d1['自动切出数量']}`)
ok('① 提示含「待排产」', String(d1['自动切单提示'] || '').includes('待排产'), d1['自动切单提示'] || '')

// ② 父/子行数量与状态
const after = (await post('/api/px/workOrderList', { keyword: 'GD-VERIFY-SPLIT-' }, token)).data || []
const parent = after.find((r) => r['工单号'] === 'GD-VERIFY-SPLIT-01')
const child = childNo ? after.find((r) => r['工单号'] === childNo) : null
ok('② 父行:需求=排产=60 且已排产(生产线=成型1线)', !!parent && Number(parent['需求数量']) === 60
  && Number(parent['排产数量']) === 60 && parent['生产线'] === '成型1线',
  parent ? `需求=${parent['需求数量']} 排产=${parent['排产数量']} 线=${parent['生产线']} 当前工序=${parent['当前工序']}` : '父行未查到')
ok('② 子行:需求=排产=40 且未排产(生产线空)', !!child && Number(child['需求数量']) === 40
  && Number(child['排产数量']) === 40 && !String(child['生产线'] || '').trim(),
  child ? `需求=${child['需求数量']} 排产=${child['排产数量']} 线=${child['生产线'] || '(空)'} 源工单=${child['源工单号']}` : '子行未查到')

// ③ 子单进待排产池,可再排产
const pending = (await post('/api/px/scheduleBoard/pending', { keyword: childNo }, token)).data || []
ok('③ 子单出现在待排产池', pending.some((r) => r['加工单号'] === childNo),
  `池内=${(pending || []).map((x) => x['加工单号']).slice(0, 5).join(',')}`)

// ④ 全排(排产数量=需求)不触发切单
const { steps: st2 } = await routeSteps(p2)
const steps2 = st2.map((s) => ({ 工序: s.工序, 生产线: lineOf[s.工序] }))
const pre2 = await post('/api/px/scheduleBoard/preplan', {
  加工单号: p2['工单号'], 行id: p2['行id'], 排产数量: 50, 步骤: steps2,
}, token)
const d2 = pre2.data || {}
ok('④ 全排(50=需求)不触发自动切单', pre2.code === 200 && !d2['自动切出子工单'],
  `code=${pre2.code} 排产=${d2['排产数量']} 自动切出=${d2['自动切出子工单'] || '(无)'}`)

const failed = results.filter((x) => !x.pass)
console.log(`\n== 汇总 ${results.length - failed.length}/${results.length} PASS ==`)
console.log(JSON.stringify({ 父单: p1['工单号'], 子单: childNo || '(无)', 夹具: ['GD-VERIFY-SPLIT-01', 'GD-VERIFY-SPLIT-02'] }, null, 1))
process.exit(failed.length ? 1 : 0)
