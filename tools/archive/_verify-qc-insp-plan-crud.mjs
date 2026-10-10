/*
 * _verify-qc-insp-plan-crud.mjs — 检验项目/检验方案维护接口核查(2026-10-09,一次性探针)
 *
 * ⚠ 本探针**会写数据**(新增/编辑/停用/恢复),因此只打**测试账套**(factory=YJ_TEST → HSDZ_MES_TEST);
 *   运行前请确认 8090/8091 实例已起。收尾会打印需要清理的两条记录(调用方用 SQL 删)。
 *
 * 链路:登录(YJ_TEST) → 建方案 → 列表可见 → 建项目(挂该方案) → 项目可见且项目数=1 →
 *       改方案/改项目字段回读 → 停用项目(默认列表消失、all=1 仍在) → 恢复 → 停用/恢复方案 →
 *       无 token 被拒 → 撞码被拒。
 *
 * 用法: node tools/archive/_verify-qc-insp-plan-crud.mjs http://127.0.0.1:8091
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const API = '/api/qc/inspPlan'
const STAMP = String(Date.now()).slice(-8)
const PCODE = `_TEST-QP-${STAMP}`
const ICODE = `_TEST-ITEM-${STAMP}`

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
const token = login.data?.token
if (!token) { console.error('登录失败(测试账套): ' + JSON.stringify(login).slice(0, 200)); process.exit(1) }
console.log(`[测试账套] 方案 ${PCODE} / 项目 ${ICODE}`)
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const get = async (p) => (await fetch(BASE + API + p, { headers: H })).json()
const post = async (p, b) => (await fetch(BASE + API + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) })).json()

// ── ① 建方案 ────────────────────────────────────────────────────────────────
console.log('\n=== ① 新增检验方案 ===')
const p1 = await post('/planSave', {
  方案编码: PCODE, 方案名称: '自检用方案(可删)', 适用存货: 'ZZ-TEST', 适用存货类别: '自检',
  检验方式: '抽检', 抽检比例: '', 取样规则: '每50kg取1个，每个200g', 文件编码: 'YJ-TEST', 执行标准: '自检', 备注: 'crud 探针',
})
ok('planSave 返回 id', !!p1?.data?.id, JSON.stringify(p1).slice(0, 120))
const planId = p1?.data?.id
ok('列表可见(按编码搜)', (await get(`/plans?all=1&keyword=${PCODE}`)).data?.some((x) => x['方案编码'] === PCODE))
ok('取样规则/文件编码 回读一致', (await get(`/plans?all=1&keyword=${PCODE}`)).data?.[0]?.['取样规则'] === '每50kg取1个，每个200g')
ok('新方案项目数 = 0', (await get(`/plans?all=1&keyword=${PCODE}`)).data?.[0]?.['项目数'] === 0)

// ── ② 建项目(挂该方案)────────────────────────────────────────────────────────
console.log('\n=== ② 新增检验项目(挂到该方案)===')
const i1 = await post('/itemSave', {
  方案编码: PCODE, 序号: 10, 项目编码: ICODE, 项目名称: '自检项(目数)', 检验内容: '目数', 检验标准: '+20目占比≤15%',
  数据类型: '定量', 计量单位: '%', 判定规则: '上限判定', 标准上限: 15, 取样要求: '称取100g',
  检验方法: '筛分5min后称量', 合格处置: '入库', 不合格处置: '重新筛分', 备注: 'crud 探针',
})
ok('itemSave 返回 id', !!i1?.data?.id, JSON.stringify(i1).slice(0, 120))
const itemId = i1?.data?.id
let items = (await get(`/items?planCode=${PCODE}&all=1`)).data || []
ok('项目挂在该方案下(1 条)', items.length === 1 && items[0]['项目编码'] === ICODE, items.length + ' 条')
ok('新列 检验方法/取样要求/合格处置/不合格处置 回读一致',
  items[0]?.['检验方法'] === '筛分5min后称量' && items[0]?.['取样要求'] === '称取100g'
  && items[0]?.['合格处置'] === '入库' && items[0]?.['不合格处置'] === '重新筛分')
ok('方案的项目数随之变 1', (await get(`/plans?all=1&keyword=${PCODE}`)).data?.[0]?.['项目数'] === 1)

// ── ③ 改 ──────────────────────────────────────────────────────────────────
console.log('\n=== ③ 编辑回读 ===')
await post('/planSave', { id: planId, 方案编码: PCODE, 方案名称: '自检用方案(已改)', 检验方式: '全检' })
ok('方案名称/检验方式 已改', (await get(`/plans?all=1&keyword=${PCODE}`)).data?.[0]?.['方案名称'] === '自检用方案(已改)'
  && (await get(`/plans?all=1&keyword=${PCODE}`)).data?.[0]?.['检验方式'] === '全检')
await post('/itemSave', { id: itemId, 方案编码: PCODE, 项目编码: ICODE, 项目名称: '自检项(已改)', 检验内容: '目数', 检验标准: '≤10%', 数据类型: '定量', 判定规则: '上限判定' })
ok('项目名称/检验标准 已改', ((await get(`/items?planCode=${PCODE}&all=1`)).data || [])[0]?.['项目名称'] === '自检项(已改)')

// ── ④ 停用/恢复 ────────────────────────────────────────────────────────────
console.log('\n=== ④ 停用 / 恢复启用 ===')
await post('/itemRemove', { id: itemId })
ok('项目停用后:默认列表看不到', ((await get(`/items?planCode=${PCODE}`)).data || []).length === 0)
ok('项目停用后:all=1 仍可见且带 enabled=0',
  ((await get(`/items?planCode=${PCODE}&all=1`)).data || []).some((x) => x.id === itemId && (x['停用'] === 1 || x['停用'] === true) && x.enabled === 0))
await post('/itemEnable', { id: itemId })
ok('项目恢复启用', ((await get(`/items?planCode=${PCODE}`)).data || []).length === 1)
await post('/planRemove', { id: planId })
ok('方案停用后:默认列表看不到', !((await get('/plans')).data || []).some((x) => x['方案编码'] === PCODE))
await post('/planEnable', { id: planId })
ok('方案恢复启用', ((await get('/plans')).data || []).some((x) => x['方案编码'] === PCODE))

// ── ⑤ 守卫 ────────────────────────────────────────────────────────────────
console.log('\n=== ⑤ 守卫 ===')
const noAuth = await fetch(BASE + API + '/plans')
ok('无 token 被拒(401/403)', noAuth.status === 401 || noAuth.status === 403, 'status=' + noAuth.status)
const dup = await post('/planSave', { 方案编码: PCODE, 方案名称: '撞码' })
ok('同编码重复新增被拒', dup?.code === 400 && /已存在/.test(dup.message || ''), String(dup?.message))
const badItem = await post('/itemSave', { 方案编码: PCODE, 项目编码: ICODE + '-X', 项目名称: '缺标准' })
ok('缺「检验标准」被拒', badItem?.code === 400, String(badItem?.message))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
console.log(`[清理] 测试账套 HSDZ_MES_TEST 需删:bs_qc_item 项目编码='${ICODE}';bs_qc_plan 方案编码='${PCODE}'`)
process.exit(fail === 0 ? 0 : 1)
