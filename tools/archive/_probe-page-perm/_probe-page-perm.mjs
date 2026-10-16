/**
 * _probe-page-perm.mjs — 一次取证探针(2026-10-16):四个看板页面的**页面级面板权限**。
 *
 * 取证两条路(缺一不可):
 *   A. 正向:管理员在「组织架构 → 角色与面板权限」里**看得见**这四条面板,且动作集按页面特性裁剪;
 *      页面接口对管理员照常放行(证明没有误拦)。
 *   B. 反向:造一个只授「快速排产」一个页面面板的探针账号,逐端点验证
 *      —— 授了的放行、没授的 403(证明闸门真的生效,而不是只改了菜单)。
 *
 * 反向探针**跑在测试账套(HSDZ_MES_TEST)**,用完即删(角色 + 账号 + 授权行);
 * 正式账套只做只读取证(A)。
 *
 * 用法: node tools/archive/_probe-page-perm/_probe-page-perm.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = `${BASE}/api`
const PROBE_USER = 'pageperm_probe'
const PROBE_PASS = 'Probe@2026'
const PROBE_ROLE = 'PAGE_PERM_PROBE'

let pass = 0
let fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  [PASS] ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  [FAIL] ${name}${extra ? ' — ' + extra : ''}`) }
}

async function call(method, path, { token, factory, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (factory) headers['X-Factory'] = factory
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* 空响应体 */ }
  return { status: res.status, json }
}

async function login(userName, password, factory) {
  const r = await call('POST', '/auth/login', { body: { userName, password, factory } })
  if (r.status !== 200 || !r.json?.data?.token) {
    throw new Error(`登录失败 ${userName}@${factory}: ${r.status} ${JSON.stringify(r.json)}`)
  }
  return r.json.data.token
}

/**
 * 权限拒绝的判据:GlobalExceptionHandler 对 AccessDeniedException 走 **body-code**
 * (HTTP 200 + code 403,故意避开 403 触发前端登出)⇒ 只看 HTTP 状态会漏判。
 */
function isDenied(r) {
  return r.status === 403 || r.json?.code === 403
}

/** 期望被拒(无权限)/ 期望放行(有权限;业务错误也算通过:说明已越过权限闸门) */
async function expect403(token, factory, label, path, body = {}) {
  const r = await call('POST', path, { token, factory, body })
  ok(`${label} 应被拒(403)`, isDenied(r), `HTTP ${r.status} code=${r.json?.code} ${r.json?.message || ''}`)
}
async function expectNot403(token, factory, label, path, body = {}) {
  const r = await call('POST', path, { token, factory, body })
  ok(`${label} 应放行`, !isDenied(r), `HTTP ${r.status} code=${r.json?.code} ${r.json?.message || ''}`)
}

/* ═══════════ A. 正式账套:只读取证 ═══════════ */
console.log('\n===== A. 正式账套 HSDZ_MES:矩阵条目 + 管理员放行 =====')
const admin = await login('admin', '123456', 'YJ')

const perms = await call('GET', '/auth/perms', { token: admin })
const pagePerms = perms.json?.data?.pagePerms || {}
ok('管理员 /auth/perms 下发 pagePerms(4 个页面码)', Object.keys(pagePerms).length === 4,
  JSON.stringify(pagePerms))
ok('管理员 pagePerms 值为通配 *', Object.values(pagePerms).every((v) => v === '*'))

const rolePanels = await call('GET', '/sys/role/1/panels', { token: admin })
const all = rolePanels.json?.data?.allPanels || []
const byCode = {}
for (const p of all) byCode[p.panelCode] = p
const expect = {
  ORDER_CONVERT: ['view', 'query', 'date', 'convert'],
  SCHEDULE_BOARD: ['view', 'query', 'assign', 'unassign'],
  WORK_ORDER_BOARD: ['view', 'query', 'transfer', 'revoke', 'unclose', 'print'],
  WORK_ORDER_LIST: ['view', 'query', 'print', 'close', 'split', 'picking', 'export', 'assign'],
}
for (const [code, words] of Object.entries(expect)) {
  const p = byCode[code]
  ok(`矩阵含面板 ${code}`, !!p, p ? `${p.panelName} @ ${p.module}` : '缺失')
  if (!p) continue
  const got = (p.actions || []).map((a) => a[0])
  ok(`${code} 动作集按页面特性裁剪`, JSON.stringify(got) === JSON.stringify(words), `实际 ${got.join(',')}`)
  ok(`${code} 不套用通用 12 项(无 audit/adjust)`, !got.includes('audit') && !got.includes('adjust'))
}

const wol = await call('POST', '/px/workOrderList', { token: admin, factory: 'YJ', body: {} })
ok('管理员读生产工单列表放行', wol.status === 200, `HTTP ${wol.status} 行数 ${wol.json?.data?.length}`)
const oc = await call('POST', '/px/orderConvert/pending', { token: admin, factory: 'YJ', body: {} })
ok('管理员读订单结转待结转放行', oc.status === 200, `HTTP ${oc.status}`)

/* ═══════════ B. 测试账套:探针角色/账号,验闸门真生效 ═══════════ */
console.log('\n===== B. 测试账套 HSDZ_MES_TEST:受限账号逐端点取证 =====')
const tAdmin = await login('admin', '123456', 'YJ_TEST')

// 清理历史残留(上次探针中断过也能重跑)
await cleanup()

const before = await call('GET', '/sys/role/list', { token: tAdmin })
await call('POST', '/sys/role/save', { token: tAdmin, body: { roleCode: PROBE_ROLE, roleName: '页面权限探针(临时)' } })
const roles = await call('GET', '/sys/role/list', { token: tAdmin })
const probeRole = (roles.json?.data || []).find((r) => r.roleCode === PROBE_ROLE)
if (!probeRole) throw new Error('探针角色创建失败')

// 只授「快速排产」:view,query,assign(不给 unassign,不给其他三页)
await call('POST', `/sys/role/${probeRole.id}/panels`, {
  token: tAdmin,
  body: { panels: [{ panelCode: 'SCHEDULE_BOARD', perms: 'view,query,assign' }] },
})
await call('POST', '/sys/user/save', {
  token: tAdmin,
  body: { userName: PROBE_USER, realName: '页面权限探针', password: PROBE_PASS, roleId: probeRole.id, enabled: 'Y', isAdmin: 'N' },
})

const users = await call('GET', '/sys/user/list', { token: tAdmin })
const probe = (users.json?.data || []).find((u) => u.userName === PROBE_USER)
ok('探针账号已建(测试账套)', !!probe, `roleId=${probeRole.id}, 创建前角色数 ${(before.json?.data || []).length}`)

const tUser = await login(PROBE_USER, PROBE_PASS, 'YJ_TEST')
const pPerms = await call('GET', '/auth/perms', { token: tUser })
const pp = pPerms.json?.data || {}
ok('受限账号 visiblePanels 只含已授权的 SCHEDULE_BOARD',
  (pp.visiblePanels || []).includes('SCHEDULE_BOARD') && !(pp.visiblePanels || []).includes('WORK_ORDER_LIST'),
  JSON.stringify(pp.visiblePanels))
ok('受限账号 pagePerms:已授页有词、未授页为空',
  pp.pagePerms?.SCHEDULE_BOARD === 'view,query,assign' && pp.pagePerms?.WORK_ORDER_LIST === '',
  JSON.stringify(pp.pagePerms))

// 授了的 → 放行
await expectNot403(tUser, 'YJ_TEST', '快速排产·待排产池', '/px/scheduleBoard/pending', { keyword: '' })
await expectNot403(tUser, 'YJ_TEST', '快速排产·统计', '/px/scheduleBoard/stats', {})
await expectNot403(tUser, 'YJ_TEST', '快速排产·今日已排产', '/px/scheduleBoard/today', { mode: 'today' })
await expectNot403(tUser, 'YJ_TEST', '工艺路线下拉(排产弹窗共用)', '/px/processTask/routes', {})
// 有 assign 词 ⇒ 越过闸门(空 rows 由 service 自行处理,403 才算被拦)
await expectNot403(tUser, 'YJ_TEST', '快速排产·排产(有 assign 词)', '/px/scheduleBoard/assign', { rows: [] })

// 没授的 → 403
await expect403(tUser, 'YJ_TEST', '快速排产·撤销排产(无 unassign 词)', '/px/scheduleBoard/unassign', { rows: [] })
await expect403(tUser, 'YJ_TEST', '订单结转·待结转(未授该页)', '/px/orderConvert/pending', {})
await expect403(tUser, 'YJ_TEST', '生产工单列表(未授该页)', '/px/workOrderList', {})
await expect403(tUser, 'YJ_TEST', '工单排产看板·产线骨架(未授该页)', '/px/scheduleBoard/linesSummary', {})
await expect403(tUser, 'YJ_TEST', '工单排产看板·调拨(未授该页)', '/px/scheduleBoard/transfer', { rows: [] })
await expect403(tUser, 'YJ_TEST', '生产工单·结案(未授该页)', '/px/workOrderList/close', { rows: [] })

await cleanup()
console.log('\n清理:探针账号/角色已删除')

async function cleanup() {
  const t = await login('admin', '123456', 'YJ_TEST')
  const us = await call('GET', '/sys/user/list', { token: t })
  for (const u of (us.json?.data || [])) {
    if (u.userName === PROBE_USER) await call('DELETE', `/sys/user/${u.id}`, { token: t })
  }
  const rs = await call('GET', '/sys/role/list', { token: t })
  for (const r of (rs.json?.data || [])) {
    if (r.roleCode === PROBE_ROLE) await call('DELETE', `/sys/role/${r.id}`, { token: t })
  }
}

console.log(`\n===== 取证结果:${pass} 通过 / ${fail} 失败 =====`)
process.exit(fail === 0 ? 0 : 1)
