/**
 * _verify-tab-isolation-20261117.mjs — 分页签面板「一张表满了不影响别的表」+ 另一个来料检验要求面板同口径
 *
 * 报障后的追加确认(用户 2026-11-17 第二轮问的两点):
 *   ① 一张表满了会不会影响别的表?   ②「另一个来料检验要求」(QC_INSP_REQ,7 张固定表)要不要也这样?
 *
 * 本脚本在**测试库(HSDZ_MES_TEST)** 上对 QC_INSP_REQ 做极限取证:
 *   1. 把最后一张表「PP棉」(段 备用121-140)填到 20/20;
 *   2. 另一张表「垫片」(段 备用21-40)照样能加列   ⇒ 证明满了不串表;
 *   3. 再往「PP棉」加 ⇒ 必须被拦,且提示点名该表(20/20),不是面板总数;
 *   4. 全部退绑复原(含顺带登记的检验项标准库条目),可反复跑。
 *
 * 用法(仓库根):node tools/archive/_extfield-tab-cap-20261117/_verify-tab-isolation-20261117.mjs
 * 正式库一个字节都不写。
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const PANEL = 'QC_INSP_REQ'
const FULL_TAB = 'PP棉' // 段 备用121-140
const FREE_TAB = '垫片' // 段 备用21-40
const PREFIX = '隔离测'

let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`[PASS] ${name}${extra ? ' — ' + extra : ''}`)
  else { fail++; console.log(`[FAIL] ${name}${extra ? ' — ' + extra : ''}`) }
}

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
if (!login?.data?.token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const get = async (url) => (await (await fetch(BASE + url, { headers: auth })).json())
const post = async (url, body) => {
  const res = await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}
const overview = async () => (await get(`/px/extFields?panel=${PANEL}`)).data
const pools = (d) => Object.fromEntries(Object.entries(d.tabPools).map(([k, v]) => [k, `${v.used}/${v.capacity}`]))
const stamp = String(Date.now()).slice(-4)

const d0 = await overview()
console.log(`\n=== 测试库 ${PANEL} ===`)
console.log('  各表用量:', JSON.stringify(pools(d0)))
ok((d0.tabs || []).length === 7, '该面板仍是 7 张表(页签 = 物料类别词表)', `${(d0.tabs || []).length} 张`)
ok(Object.values(d0.tabPools).every((p) => p.used < p.capacity), '起手没有一张表是满的')

// ---------- 1. 把「PP棉」填到 20/20 ----------
const need = 20 - d0.tabPools[FULL_TAB].used
const made = []
for (let i = 1; i <= need; i++) {
  const r = await post('/px/extField/add', {
    panel: PANEL, tab: FULL_TAB, label: `${PREFIX}满${stamp}-${i}`, dataType: '文本', place: 'detail', confirmDirty: true,
  })
  if (r.body?.code !== 200) { ok(false, `填满「${FULL_TAB}」第 ${i} 列`, JSON.stringify(r.body).slice(0, 160)); break }
  made.push(r.body.data.fieldId)
}
const d1 = await overview()
ok(d1.tabPools[FULL_TAB].used === 20, `「${FULL_TAB}」已填满`, `${d0.tabPools[FULL_TAB].used} → ${d1.tabPools[FULL_TAB].used}/20`)

// ---------- 2. 另一张表照样能加(满表不串表) ----------
const freeBefore = d1.tabPools[FREE_TAB].used
const rFree = await post('/px/extField/add', {
  panel: PANEL, tab: FREE_TAB, label: `${PREFIX}独立${stamp}`, dataType: '文本', place: 'detail', confirmDirty: true,
})
ok(rFree.body?.code === 200, `「${FULL_TAB}」满额时,「${FREE_TAB}」仍可新增(不串表)`,
  `${rFree.status} col=${rFree.body?.data?.colName || rFree.body?.message}`)
const d2 = await overview()
ok(d2.tabPools[FREE_TAB].used === freeBefore + 1, `「${FREE_TAB}」用量 +1`, `${freeBefore} → ${d2.tabPools[FREE_TAB].used}`)
ok(d2.tabPools[FULL_TAB].used === 20, `「${FULL_TAB}」用量保持不变`, `${d2.tabPools[FULL_TAB].used}/20`)
if (rFree.body?.data?.fieldId) made.push(rFree.body.data.fieldId)

// ---------- 3. 再往满表加:必须被拦,且提示点名该表 ----------
const rFull = await post('/px/extField/add', {
  panel: PANEL, tab: FULL_TAB, label: `${PREFIX}超${stamp}`, dataType: '文本', place: 'detail', confirmDirty: true,
})
const msg = String(rFull.body?.message || '')
ok(rFull.body?.code !== 200, '满表再加被服务端拦下', `code=${rFull.body?.code}`)
ok(msg.includes(FULL_TAB) && msg.includes('20/20'), '拒绝理由点名「本表 20/20」,而不是面板总数', msg)
ok(!msg.includes(String(d2.fields.length) + '/'), '不出现「面板累计/20」这种口径', `面板累计=${d2.fields.length}`)

// ---------- 4. 清场 ----------
const d3 = await overview()
const mine = (d3.fields || []).filter((f) => String(f.label || '').startsWith(PREFIX))
for (const f of mine) await post('/px/extField/retire', { panel: PANEL, fieldId: f.id })
const lib = (await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []
const libHits = lib.filter((x) => String(x.content || '').startsWith(PREFIX))
for (const h of libHits) await post('/stdlib/destroy', { id: h.id })
const d4 = await overview()
ok((d4.fields || []).filter((f) => String(f.label || '').startsWith(PREFIX)).length === 0,
  '测试库已复原(临时列全部退绑)', JSON.stringify(pools(d4)))
ok(libHits.length === 0 || ((await get('/stdlib/list?lib=qc.insp_item&all=1')).data || []).every((x) => !String(x.content || '').startsWith(PREFIX)),
  '检验项标准库临时条目已清掉', `${libHits.length} 条`)

console.log(fail === 0 ? '\n[RESULT] PASS' : `\n[RESULT] FAIL(${fail} 项)`)
process.exit(fail === 0 ? 0 : 1)
