/**
 * _api-picking-flow.mjs — 「先排产后领料 + 一单多张领料」接口探针(2026-10-18)
 *
 * 口径(用户 2026-10-18):
 *   「先要完成排产才进入到领料,同时需要让当前的一个生产工单可以对应多个领料单据」
 *   ① 未排产(产线空 / 排产数量 0)的工单行转领料单必须被拒,并提示先去快速排产;
 *   ② 已排产的工单行可以**连续**转出多张领料草稿(不再有"已有未审核领料单"的拦截);
 *   ③ 每张单头:加工单号=工单号、工单行号=本行、备注写明第几张。
 *
 * 只写**测试账套 HSDZ_MES_TEST**(登录 factory=YJ_TEST),正式账套零写入。
 * 用法(仓库根):node tools/archive/_picking-flow-20261018/_api-picking-flow.mjs [--cleanup]
 *   --cleanup 传了才删探针单(默认保留,便于界面核对)
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

const SCHEDULED = { 工单号: 'GD-2026-10-0001', 工单行号: 3 }   // 测试库:scx=1号车间 / pl_sl=2901
const UNSCHEDULED = { 工单号: 'MO-2026-09-0007', 工单行号: 1 } // 测试库:scx 空 / pl_sl=514

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  [PASS] ${msg}`) }
  else { fail++; console.log(`  [FAIL] ${msg}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 200))
  return j.data.token
}

async function api(token, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON 原样返回 */ }
  return { status: r.status, json, text }
}

const toPicking = (token, row) => api(token, '/api/px/workOrderList/toPicking', { rows: [row] })

/** 取某张领料单在**列表接口**里的一行(单头字段:加工单号/工单行号/备注/单据状态) */
async function listRowOf(token, no) {
  const q = await api(token, '/api/px/queryFormDataList', {
    panelCode: 'MATERIAL_OUT', keyword: no, pageNo: 1, pageSize: 50, condition: {},
  })
  const list = q.json?.data?.list || []
  return list.find((x) => String(x['单据编号'] || x['编号']) === String(no)) || null
}

const token = await login()
console.log('登录 OK(factory=YJ_TEST ⇒ 写操作全部落在测试账套)')

// ── 1. 负例:未排产(产线空)不给转领料 ────────────────────────────────
console.log('\n[1] 未排产的行转领料单 → 必须被拒并提示先去快速排产')
const neg = await toPicking(token, UNSCHEDULED)
const negMsg = JSON.stringify(neg.json || neg.text)
ok(neg.status !== 200 || Number(neg.json?.code) >= 400, `接口未返回成功(HTTP ${neg.status})`)
ok(/未排产|未排入产线|快速排产/.test(negMsg), `提示点名「未排产/请先排产」:${negMsg.slice(0, 180)}`)

// ── 2/3. 正例:已排产的行可以连续转两张(一单多张)────────────────────
console.log('\n[2] 已排产的行转领料单 → 第 1 张')
const p1 = await toPicking(token, SCHEDULED)
ok(p1.json?.code === 200, `第 1 张生成成功:${JSON.stringify(p1.json?.data?.['单号清单'] || p1.json?.message || '').slice(0, 200)}`)
const no1 = (p1.json?.data?.['单号清单'] || [])[0]?.split('→')?.[1]

console.log('\n[3] 同一工单行再转 → 第 2 张(不再被"已有未审核领料单"挡住)')
const p2 = await toPicking(token, SCHEDULED)
ok(p2.json?.code === 200, `第 2 张生成成功:${JSON.stringify(p2.json?.data?.['单号清单'] || p2.json?.message || '').slice(0, 200)}`)
const no2 = (p2.json?.data?.['单号清单'] || [])[0]?.split('→')?.[1]
ok(!!no1 && !!no2 && no1 !== no2, `两张单号不同:${no1} / ${no2}`)

// ── 4. 单头内容:加工单号/工单行号/备注第几张 ────────────────────────
console.log('\n[4] 单头:加工单号=工单号、工单行号=本行、备注写明第几张')
for (const [label, no, seq] of [['第1张', no1, '第 1 张'], ['第2张', no2, '第 2 张']]) {
  const row = no ? await listRowOf(token, no) : null
  ok(!!row, `${label} ${no} 在材料出库单列表可见`)
  if (!row) continue
  ok(String(row['加工单号']) === SCHEDULED.工单号, `${label} ${no} 加工单号=${row['加工单号']}`)
  ok(String(row['工单行号']) === String(SCHEDULED.工单行号), `${label} ${no} 工单行号=${row['工单行号']}`)
  ok(String(row['备注'] || '').includes(seq), `${label} ${no} 备注含「${seq}」:${row['备注']}`)
}

// ── 5. 收尾:--cleanup 才删探针单 ────────────────────────────────────
if (process.argv.includes('--cleanup')) {
  console.log('\n[5] 清理探针单')
  for (const no of [no1, no2]) {
    if (!no) continue
    const r = await api(token, '/api/px/deleteForms', { panelCode: 'MATERIAL_OUT', rowCodes: [no] })
    ok(r.json?.code === 200, `删除 ${no}:${JSON.stringify(r.json?.message || '').slice(0, 80)}`)
    await sleep(150)
  }
}
console.log(`\n== 结果: ${pass} 通过 / ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
