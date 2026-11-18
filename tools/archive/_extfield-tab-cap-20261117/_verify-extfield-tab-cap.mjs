/**
 * _verify-extfield-tab-cap.mjs — 「来料检验要求(系列)」自定义列上限口径回归(2026-11-17)
 *
 * 缺陷(用户报障,截图):面板「来料检验要求(系列)」每张表都远未满(0~14/20),点「添加」却报
 *   「该面板自定义列已达上限(28/20)」—— 后端 addExtField 把**每表各 20 个**的池按**面板总数**判,
 *   系列面板累计超过 20 列就整面板加不了列。
 *
 * 修法:分页签面板的上限改按「该页签那一段备用列」判(与分配器同源,见 PanelConfigService.tabUsedOf)。
 *
 * 本脚本只做**只读总览核对 + 测试库(HSDZ_MES_TEST)加一列再退绑**:
 *   · 正式库(HSDZ_MES)一个字节都不写;
 *   · 测试库新增的列在结尾 retire 掉(退绑=DELETE yj_field 行、物理列留空),可反复跑。
 *
 * 用法(仓库根):node tools/archive/_extfield-tab-cap-20261117/_verify-extfield-tab-cap.mjs
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const PANEL = 'QC_INSP_REQ_SERIES'

let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`[PASS] ${name}${extra ? ' — ' + extra : ''}`)
  else { fail++; console.log(`[FAIL] ${name}${extra ? ' — ' + extra : ''}`) }
}

async function login(factory) {
  const r = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })).json()
  if (!r?.data?.token) throw new Error('登录失败(' + factory + '): ' + JSON.stringify(r).slice(0, 200))
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${r.data.token}` }
}
const get = async (auth, url) => (await (await fetch(BASE + url, { headers: auth })).json())
const post = async (auth, url, body) => {
  const res = await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}
const pools = (d) => JSON.stringify(Object.fromEntries(Object.entries(d.tabPools || {}).map(([k, v]) => [k, `${v.used}/${v.capacity}`])))

const prod = await login('YJ')
const test = await login('YJ_TEST')

// ---------- 1. 两个账套的总览口径 ----------
for (const [name, auth] of [['正式库', prod], ['测试库', test]]) {
  const d = (await get(auth, `/px/extFields?panel=${PANEL}`)).data || {}
  console.log(`\n=== ${name} ${PANEL} ===`)
  console.log('  cap/usedOfCap(面板总数,仅提示) =', d.cap, '/', d.usedOfCap, '| capacity =', d.capacity)
  console.log('  每表用量:', pools(d))
  const tabs = Object.values(d.tabPools || {})
  ok(tabs.length > 0, `${name}:下发 tabPools`, `${tabs.length} 张表`)
  ok(tabs.every((t) => t.used <= t.capacity), `${name}:每张表用量都不超过 20`)
  const sum = tabs.reduce((a, t) => a + t.used, 0)
  ok(sum === (d.fields || []).length, `${name}:各表用量之和 = 动态字段总数`, `${sum} vs ${(d.fields || []).length}`)
  ok(sum > d.cap, `${name}:该面板累计列数已超过面板级 20(正是原判据误伤的形态)`, `${sum} > ${d.cap}`)
}

// ---------- 2. 测试库:找一张没满的表加一列(原缺陷下这一步会报 28/20) ----------
const dTest = (await get(test, `/px/extFields?panel=${PANEL}`)).data || {}
const target = Object.entries(dTest.tabPools || {}).filter(([, v]) => v.free >= 2).sort((a, b) => b[1].free - a[1].free)[0]
ok(!!target, '测试库:存在仍有空位的表', target ? `${target[0]} ${target[1].used}/${target[1].capacity}` : '')
const [tab, pool] = target || []
const stamp = String(Date.now()).slice(-5)
const label = `验证列${stamp}`
let made = null
if (tab) {
  const r = await post(test, '/px/extField/add', {
    panel: PANEL, tab, label, label2: undefined, parent: `验证父${stamp}`,
    dataType: '文本', place: 'detail', width: 120,
  })
  const msg = r.body?.message || ''
  ok(r.status === 200 && r.body?.code === 200, `测试库:「${tab}」可新增自定义列(原缺陷在此报「已达上限(x/20)」)`,
    `${r.status} ${msg} col=${r.body?.data?.colName || ''}`)
  if (r.body?.code === 200) made = { fieldId: r.body.data.fieldId, colName: r.body.data.colName, label }
  const d2 = (await get(test, `/px/extFields?panel=${PANEL}`)).data || {}
  ok((d2.tabPools?.[tab]?.used ?? -1) === pool.used + 1, `测试库:「${tab}」用量 +1`, `${pool.used} → ${d2.tabPools?.[tab]?.used}`)
}

// ---------- 3. 退绑清场(不给测试库留垃圾) ----------
if (made?.fieldId) {
  const r = await post(test, '/px/extField/retire', { panel: PANEL, fieldId: made.fieldId })
  ok(r.status === 200 && r.body?.code === 200, '测试库:验证列已退绑', JSON.stringify(r.body).slice(0, 160))
  const d3 = (await get(test, `/px/extFields?panel=${PANEL}`)).data || {}
  ok((d3.tabPools?.[tab]?.used ?? -1) === pool.used, `测试库:「${tab}」用量复原`, `→ ${d3.tabPools?.[tab]?.used}`)
  // 绑定会顺带把列名登记进「检验项」标准库(qc.insp_item),退绑不会删条目 ⇒ 这里彻底删掉验证用的那条
  const lib = (await get(test, '/stdlib/list?lib=qc.insp_item')).data || []
  const rows = Array.isArray(lib) ? lib : lib.list || []
  const hits = rows.filter((x) => String(x.content || '').trim() === label)
  for (const h of hits) await post(test, '/stdlib/destroy', { id: h.id })
  const left = ((await get(test, '/stdlib/list?lib=qc.insp_item')).data || []).filter((x) => String(x.content || '').trim() === label)
  ok(left.length === 0, '测试库:检验项标准库验证条目已清掉', `删了 ${hits.length} 条,剩 ${left.length} 条`)
}

console.log(fail === 0 ? '\n[RESULT] PASS' : `\n[RESULT] FAIL(${fail} 项)`)
process.exit(fail === 0 ? 0 : 1)
