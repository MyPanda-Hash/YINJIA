/**
 * verify-20261106.mjs — 两条改动的端到端核对(纯 HTTP,不做 UI)
 *
 * ① 删除离线打印电脑:新增 → 删掉 → 库里行没了;心跳成"在线"后删 → 服务端拒绝
 * ② 已存在的领料单也打印:对着测试库里已经开过单的工单再扫一次
 *    → 成功[0].重复 === true 且 打印 !== null 且 打印.明细 有行(以前这里是 null)
 *
 * 用法(仓库根):node tools/archive/_verify-20261106.mjs
 */
const BASE = 'http://127.0.0.1:8090'

async function login(factory) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json()
  return j?.data?.token || ''
}

async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: r.status, ok: r.ok, json: j, text }
}

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}`)
  if (detail !== undefined) console.log(`       ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

const tok = await login('YJ')
const H = 'HSDZ_MES'
const name = '临时-删除测试'

// ── ① 删除离线站点 ──────────────────────────────────────────────
let r = await call('POST', '/api/px/print/station', tok, { stationName: name, enabled: false, types: ['PICK_SLIP'], paper: 'A5' })
const listedAfterCreate = (r.json?.data?.stations || []).some((s) => s.name === name)
check('新增离线站点后出现在清单里', listedAfterCreate, listedAfterCreate ? '' : JSON.stringify(r.json?.data?.stations?.map((s) => s.name)))

r = await call('POST', '/api/px/print/station/delete', tok, { stationName: name })
const goneRows = r.json?.data?.['删除的配置行数']
const listedAfterDelete = (r.json?.data?.stations || []).some((s) => s.name === name)
check('删除离线站点', r.ok && !listedAfterDelete, `清了 ${goneRows} 行配置;清单里还有它 = ${listedAfterDelete}`)

// ── ①b 在线站点不许删(先打一次心跳) ────────────────────────────
const online = '临时-在线测试'
await call('POST', '/api/px/print/station', tok, { stationName: online, enabled: false, types: ['PICK_SLIP'], paper: 'A5' })
await call('POST', '/api/px/print/heartbeat', tok, { station: online })
r = await call('POST', '/api/px/print/station/delete', tok, { stationName: online })
const msg = r.json?.message || ''
check('在线站点拒绝删除并给出原因', !r.ok && /在线/.test(msg), msg || `status=${r.status}`)

// ── ② 已存在的领料单也打印(测试库:GD-2026-11-0011 行1 已有 LL-2026-11-0015) ──
const tokT = await login('YJ_TEST')   // YJ_TEST = 测试库(HSDZ_MES_TEST 这种写法会静默落回正式库)
const wo = { woNo: 'GD-2026-11-0011', line: 1 }
r = await call('POST', '/api/px/mobilePick/create/batch', tokT, { items: [wo], 打印: true })
const row = r.json?.data?.成功?.[0]
const payload = row?.打印
check('重复扫码:标记为已存在(不生新单)', row?.重复 === true, `重复=${row?.重复} 领料单号=${row?.领料单号} 状态=${row?.状态}`)
check('重复扫码:仍然返回打印载荷', !!payload, payload ? `标题=${payload.标题} 单号=${payload.领料单号} 明细 ${payload.明细?.length ?? 0} 行` : '打印 = null(未修好)')
check('打印载荷里的明细有内容', Array.isArray(payload?.明细) && payload.明细.length > 0,
  payload?.明细?.[0] ? JSON.stringify(payload.明细[0]) : '明细为空')

const bad = results.filter((x) => !x.pass).length
console.log(`\n共 ${results.length} 项,失败 ${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
