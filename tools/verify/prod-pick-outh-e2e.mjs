/**
 * 生产领料(PROD_PICK_LIST)端到端验证 —— 本地与服务器通用。
 *
 * 为什么要有它：面板是「元数据驱动」的，SQL 跑通只证明 yj_panel/yj_field 写进去了；
 * 真正证明"装好了"必须走一次真实请求：登录 → 取面板配置 → 取一页数据。
 *
 * 用法（默认打本机 8090 的**正式账套**，outh 只在正式库里是真实数据）：
 *   node tools/verify/prod-pick-outh-e2e.mjs
 *   node tools/verify/prod-pick-outh-e2e.mjs --factory YJ_TEST --url http://127.0.0.1:8090
 *   node tools/verify/prod-pick-outh-e2e.mjs --user admin --pass 123456 --expect-total 2094
 *
 * 输出：逐条 PASS/FAIL，末行 RESULT: PROD-PICK-E2E-PASS / PROD-PICK-E2E-FAIL（部署脚本按它判定）
 */

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const BASE = opt('url', 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = opt('factory', 'YJ')
const USER = opt('user', 'admin')
const PASS = opt('pass', '123456')
const PANEL = 'PROD_PICK_LIST'
const EXPECT_TOTAL = Number(opt('expect-total', '0')) // 0 = 不校验具体行数

let failed = 0
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
  if (!cond) failed++
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 300) } }
  return { status: res.status, json }
}

const t0 = Date.now()
console.log(`[生产领料验证] ${BASE}  账套=${FACTORY}  账号=${USER}`)

// ── 1. 登录（走所选工厂，令牌里带账套声明）────────────────────────────────
const login = await api('/api/auth/login', {
  method: 'POST',
  body: { userName: USER, password: PASS, factory: FACTORY },
})
const token = login.json?.data?.token
ok('登录', !!token, token ? '' : `HTTP ${login.status} ${JSON.stringify(login.json).slice(0, 200)}`)
if (!token) {
  console.log('RESULT: PROD-PICK-E2E-FAIL')
  process.exitCode = 1
  process.exit(1)
}
ok('登录后账套一致', login.json?.data?.user?.factory === FACTORY, `factory=${login.json?.data?.user?.factory}`)

// ── 2. 面板配置（GET /api/px/getPanelConfig）───────────────────────────────
const cfg = await api(`/api/px/getPanelConfig?panelCode=${PANEL}`, { token })
ok('getPanelConfig 返回 200', cfg.json?.code === 200, `HTTP ${cfg.status} ${cfg.json?.message ?? ''}`)
const meta = cfg.json?.data?.metadata ?? {}
const tabs = cfg.json?.data?.detail?.tabs ?? []
const gridFields = tabs.flatMap((t) => t.fields ?? [])
const queryFields = (meta.panelPageDto?.tablePages ?? []).flatMap((p) => p.queryFields ?? [])

ok('面板名称 = 生产领料', meta.panelName === '生产领料', `panelName=${meta.panelName ?? '(空)'}`)
ok('面板类别 = 报表（与混料记录同款呈现）', meta.panelCategory === '报表', `category=${meta.panelCategory ?? '(空)'}`)
ok('列表有列', gridFields.length > 0, `列数=${gridFields.length}`)
ok('查询条有字段', queryFields.length > 0, `查询字段=${queryFields.length}: ${queryFields.slice(0, 6).map((f) => f.dataName).join('/')}`)
ok('只读：没有新增/保存/删除类按钮', (meta.panelButtons ?? []).length === 0,
  `panelButtons=${JSON.stringify((meta.panelButtons ?? []).map((b) => b.buttonName ?? b))}`)
const writable = gridFields.filter((f) => f.editable === true || f.readonly === false)
ok('只读：列字段均不可编辑', writable.length === 0,
  writable.length ? '可编辑列: ' + writable.map((f) => f.label ?? f.dataName).join(',') : '')

// ── 3. 取一页数据（走 queryFlat 的真实 SQL：SELECT t.id AS __id … ORDER BY …）──
const q = await api('/api/px/queryFormDataList', {
  method: 'POST',
  token,
  body: { panelCode: PANEL, condition: {}, keyword: '', pageNo: 1, pageSize: 20 },
})
ok('queryFormDataList 返回 200', q.json?.code === 200, `HTTP ${q.status} ${q.json?.message ?? ''}`)
const total = q.json?.data?.totalSize
const list = q.json?.data?.list ?? []
ok('能取到数据', typeof total === 'number' && total > 0, `totalSize=${total} 本页=${list.length}`)
if (EXPECT_TOTAL > 0) ok(`总行数 = ${EXPECT_TOTAL}`, total === EXPECT_TOTAL, `actual=${total}`)
if (list.length) {
  const keys = Object.keys(list[0])
  ok('行数据带 id（flat 行键）', 'id' in list[0], '')
  ok('行数据有业务列', keys.filter((k) => k !== 'id').length >= 8,
    `${keys.length} 列: ${keys.slice(1, 8).join('/')}…`)
  ok('行数据含「单据编号 / 数量」（材料出库单据已显示）',
    '单据编号' in list[0] && '数量' in list[0],
    `单据编号=${list[0]['单据编号'] ?? '(空)'} 数量=${list[0]['数量'] ?? '(空)'}`)
}

// ── 4. 关键字查询（证明查询条真的在过滤，不是把整表倒出来）───────────────────
const docNo = list[0]?.['单据编号']
if (docNo) {
  const kw = await api('/api/px/queryFormDataList', {
    method: 'POST',
    token,
    body: { panelCode: PANEL, condition: { 单据编号: docNo }, keyword: '', pageNo: 1, pageSize: 20 },
  })
  const kwList = kw.json?.data?.list ?? []
  ok('按单据编号筛选能命中', kwList.length > 0 && kwList.every((r) => r['单据编号'] === docNo),
    `条件=${docNo} 命中=${kwList.length} 条`)
}

// ── 5. 菜单可见性（面板权限行已补授 → 普通角色也能看到入口）──────────────────
const u = login.json?.data?.user ?? {}
const userPanels = u.visiblePanels
if (u.isAdmin === true) {
  ok('管理员：菜单全量可见（visiblePanels 不参与过滤）', true,
    `visiblePanels=${Array.isArray(userPanels) ? userPanels.length : '?'}`)
} else {
  ok('普通角色可见该面板（授权行已补授）', Array.isArray(userPanels) && userPanels.includes(PANEL), '')
}

const ms = Date.now() - t0
console.log(`\n耗时 ${ms}ms`)
console.log(failed === 0 ? 'RESULT: PROD-PICK-E2E-PASS' : `RESULT: PROD-PICK-E2E-FAIL (${failed} 项不通过)`)
// 用 exitCode 而不是 process.exit()：Windows 上抢在 fetch 句柄关闭前强退会触发 libuv 断言
process.exitCode = failed === 0 ? 0 : 1
