/**
 * _q-perm-gate-e2e.mjs —— 权限词表归位的端到端验收(活体接口,只读业务数据)
 *
 * 验三件事:
 *  A. 组织架构矩阵下发的动作集:旧实例(8090)13 项含废词 vs 新实例(8091)11 项引擎词
 *  B. 正例:补齐 audit 后,研发审核(cp)在 RD_SCALE/RD_APPROVAL 点「审核」**过前门**
 *     (判据:报错从「当前角色无该面板「审批」权限」变成「表单数据不存在」——说明已走到业务层)
 *  C. 反例:文件负责人(liulei)在没有 audit/add 的面板上仍被 403(证明没有顺手放开所有人)
 *
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-perm-gate-e2e.mjs [--new http://127.0.0.1:8090]
 *   两个参数都可指向同一实例(默认就是 8090 一处跑完;要 A/B 才传 --old 指向未重建的实例)
 */
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const OLD = arg('old', 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const NEW = arg('new', 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const PWD = arg('pwd', '123456')

const post = async (base, p, b, token) => (await (await fetch(base + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {}),
})).json())
const get = async (base, p, token) => (await (await fetch(base + p, {
  headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) },
})).json())

const login = async (base, user) => {
  const r = await post(base, '/auth/login', { userName: user, password: PWD })
  if (r?.code !== 200) return { err: JSON.stringify(r).slice(0, 100) }
  return { token: r.data.token, data: r.data }
}

console.log(`旧实例(未改代码)= ${OLD}\n新实例(本次改动)= ${NEW}\n`)

/* ───────── A. 动作集 before/after ───────── */
console.log('== A. 组织架构矩阵「研发管理」动作集 ==')
const actsOf = async (base, token, roleId) => {
  const r = await get(base, `/sys/role/${roleId}/panels`, token)
  const mods = r?.data?.modules || []
  const rd = mods.find((m) => m.code === '研发管理')
  if (!rd) return null
  const sets = new Map()
  for (const p of rd.panels) sets.set(p.panelCode, (p.actions || []).map((a) => a[0]).join(','))
  const uniq = [...new Set(sets.values())]
  return { uniq, n: rd.panels.length, sample: sets.get('RD_PROGRESS') }
}
for (const [tag, base] of [['旧(8090)', OLD], ['新(8091)', NEW]]) {
  const a = await login(base, 'admin')
  if (a.err) { console.log(`  ${tag} 登录失败 ${a.err}`); continue }
  const g = await actsOf(base, a.token, 2)
  if (!g) { console.log(`  ${tag} 取不到研发管理分组`); continue }
  console.log(`  ${tag} 研发面板 ${g.n} 张;下发的动作集共 ${g.uniq.length} 种:`)
  for (const u of g.uniq) console.log(`      [${u}]`)
  console.log(`      RD_PROGRESS 的列 = [${g.sample}]`)
}

/* ───────── B/C. 按钮前门 ───────── */
console.log('\n== B/C. callButton 前门判定(用不存在的单号探测,不改任何业务数据)==')
const NO = 'E2E-NOSUCH-0001'
const probe = async (base, token, panelCode, buttonName) => {
  const r = await post(base, '/px/callButton', { panelCode, buttonName, formData: { 编号: NO }, buttonParam: {} }, token)
  const msg = String(r?.message || r?.msg || '')
  /* 判据 = PanelPermissionService.denyMessage 的原话「当前角色无该面板「…」权限」/ requirePanelView 的
     「当前角色无该面板的查看权限」 —— **只有这两句才是权限前门拦下**;
     其余报错(「表单数据不存在」「仅管理员可直接审核」「只有该文件的责任人…」)都说明**已经过了前门**,
     是业务层/身份层的下一道闸门在说话。 */
  const gate = /无该面板/.test(msg) ? '前门403' : '已过前门'
  return { code: r?.code, msg: msg.slice(0, 60), gate }
}

const tokens = {}
for (const u of ['cp', 'liulei', 'chaishanyin']) {
  const a = await login(NEW, u)
  tokens[u] = a.token
  console.log(`  登录 ${u}: ${a.err ? '失败 ' + a.err : 'OK'}`)
}

const CASES = [
  // [账号, 面板, 按钮, 期望, 说明]
  // —— 正例:同一面板同一按钮,有 audit 的人过前门;下面 liulei 那条是同一格的反面 ——
  ['cp', 'RD_SCALE', '审核', '已过前门', '研发审核在 RD_SCALE 有 can_approve=Y(本次补 audit)⇒ 前门放行,拦他的是「仅管理员可直接审核」业务规则'],
  ['cp', 'RD_APPROVAL', '审核', '已过前门', 'RD_APPROVAL 本来就有 audit'],
  ['cp', 'RD_CHANGE', '提交审批', '已过前门', 'RD_CHANGE 覆盖词 add/modify(cp 有)'],
  ['liulei', 'RD_SPEC_DOC', '弃审', '已过前门', '四文件弃审前门 add/modify/audit(文件负责人有 add/modify)⇒ 拦他的是身份门「只有该文件的责任人」'],
  // —— 反例:没有对应词的账号仍被前门 403(证明不是"顺手放开所有人") ——
  ['liulei', 'RD_SCALE', '审核', '前门403', '反例:文件负责人在 RD_SCALE 无 audit,同一格仍被前门拦 ⇒ 门是按角色生效的'],
  ['liulei', 'RD_SHARE_FILE', '新增', '前门403', '反例:共享文件库只有 view/query'],
  ['liulei', 'RD_SHARE_FILE', '删除', '前门403', '反例:同上,删除也拦'],
  ['chaishanyin', 'RD_PROD_DOCLIST', '删除', '前门403', '反例:产品文件列表只有 view/query/export/print'],
]
let bad = 0
for (const [user, panel, btn, want, why] of CASES) {
  const r = await probe(NEW, tokens[user], panel, btn)
  const ok = r.gate === want
  if (!ok) bad++
  console.log(`  ${ok ? '✅' : '❌'} ${user} · ${panel} · ${btn} → ${r.gate}(期望 ${want}) | ${r.msg} | ${why}`)
}
console.log(`\n${bad === 0 ? '[PASS]' : '[FAIL]'} 前门断言 ${CASES.length - bad}/${CASES.length} 命中期望`)
