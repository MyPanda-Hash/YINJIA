/* _v-extperm-api.mjs — 「自定义字段」配置权限(2026-10-09)端到端取证
 *
 * 口径:自定义字段的配置权由「仅超级管理员」改为组织架构 →「角色与面板权限」逐面板授权
 * (权限词 field)。本探针在**测试账套 HSDZ_MES_TEST** 上跑完整闭环,不碰正式库业务数据:
 *
 *   ① 管理员登录 → perms.fieldPanels = ['*'](管理员恒可)
 *   ② 管理员建「探针角色 + 探针账号」,只给该角色 QC_INSP_REQ 的「可见」
 *   ③ 以探针账号登录 → fieldPanels 不含 QC_INSP_REQ;
 *      POST /px/extField/add(空 label)应被 **403「仅该面板『自定义字段』权限」** 拦下
 *   ④ 管理员按界面同一接口 POST /sys/role/{id}/panels 勾上 field →
 *      再以探针账号登录 → fieldPanels 含 QC_INSP_REQ;
 *      同一请求应穿过权限闸门、落到**参数校验**(「字段名必须 1-60 个字符」)
 *   ⑤ 收尾:删探针账号 + 探针角色(测试账套不留垃圾)
 *
 * ⚠ 全程只用「空 label」这种**必然被参数校验拒绝**的请求探权限 —— 不写任何 yj_field/业务数据。
 *
 * 用法:node tools/archive/_extperm/_v-extperm-api.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const PROBE_ROLE_CODE = 'extperm_probe'
const PROBE_USER = 'extperm_probe'
const PANEL = 'QC_INSP_REQ'

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON 原样带出 */ }
  return { http: res.status, body: json ?? text }
}

async function login(userName, password) {
  const r = await api('POST', '/auth/login', { userName, password, factory: FACTORY })
  if (!r.body || r.body.code !== 200) throw new Error(`登录失败 ${userName}: ${JSON.stringify(r.body)}`)
  return r.body.data
}

const adminPwd = process.env.YINJIA_ADMIN_PWD || '123456'

console.log(`== 目标 ${BASE}(账套 ${FACTORY})==`)

// ---------- ① 管理员 ----------
const admin = await login('admin', adminPwd)
check('管理员登录成功', !!admin.token, admin.user?.realName || '')
check('管理员 fieldPanels = [\'*\']', JSON.stringify(admin.user.fieldPanels) === '["*"]', JSON.stringify(admin.user.fieldPanels))

// ---------- ② 探针角色 + 探针账号 ----------
const roleList = await api('GET', '/sys/role/list', undefined, admin.token)
const old = (roleList.body.data || []).filter((r) => r.roleCode === PROBE_ROLE_CODE)
for (const r of old) await api('DELETE', '/sys/role/' + r.id, undefined, admin.token)
const userList = await api('GET', '/sys/user/list', undefined, admin.token)
const oldUser = (userList.body.data || []).find((u) => u.userName === PROBE_USER)
if (oldUser) await api('DELETE', '/sys/user/' + oldUser.id, undefined, admin.token)

let r2 = await api('POST', '/sys/role/save', { roleCode: PROBE_ROLE_CODE, roleName: '自定义字段权限探针', remark: '探针自动创建,用完即删' }, admin.token)
check('建探针角色', r2.body.code === 200, JSON.stringify(r2.body.message))
const roles = (await api('GET', '/sys/role/list', undefined, admin.token)).body.data || []
const roleId = roles.find((r) => r.roleCode === PROBE_ROLE_CODE).id

let r3 = await api('POST', '/sys/user/save', { userName: PROBE_USER, realName: '探针账号', password: adminPwd, roleId, enabled: 1 }, admin.token)
check('建探针账号', r3.body.code === 200, JSON.stringify(r3.body.message))

// 角色面板授权接口下发的动作集必须已含「自定义字段」列(组织架构矩阵的新列)
const rp0 = await api('GET', `/sys/role/${roleId}/panels`, undefined, admin.token)
const allPanels = rp0.body.data.allPanels || []
const actsGeneric = rp0.body.data.actions.map((a) => a[0])
check('权限矩阵动作集含 field', actsGeneric.includes('field'), actsGeneric.join(','))
const actsQc = (allPanels.find((p) => p.panelCode === PANEL) || {}).actions?.map((a) => a[0]) || []
check(`${PANEL} 一行含 field 且标签为「自定义字段」`, actsQc.includes('field')
  && (allPanels.find((p) => p.panelCode === PANEL).actions.find((a) => a[0] === 'field')[1] === '自定义字段'), actsQc.join(','))
const filePanel = allPanels.find((p) => ['RD_PLAN', 'RD_PROD_INFO', 'RD_SPEC_DOC'].includes(p.panelCode))
if (filePanel) check(`文书类面板 ${filePanel.panelCode} 也含 field`, (filePanel.actions || []).some((a) => a[0] === 'field'))

// 只给「可见」,先不给 field
await api('POST', `/sys/role/${roleId}/panels`, { panels: [{ panelCode: PANEL, perms: 'view' }] }, admin.token)

// ---------- ③ 未授权:该面板的自定义字段接口必须 403 ----------
const probe = await login(PROBE_USER, adminPwd)
check('探针账号登录成功(可见但无 field)', !!probe.token)
check('未授权时 fieldPanels 不含 QC_INSP_REQ', !(probe.user.fieldPanels || []).includes(PANEL), JSON.stringify(probe.user.fieldPanels))

const denyAdd = await api('POST', '/px/extField/add', { panel: PANEL, label: '', dataType: '文本', place: 'detail' }, probe.token)
check('未授权 POST /px/extField/add 被 403 拦下', denyAdd.body.code === 403, `code=${denyAdd.body.code} ${denyAdd.body.message}`)
check('403 文案点明「自定义字段」权限', String(denyAdd.body.message || '').includes('自定义字段'), String(denyAdd.body.message))

const denyRetire = await api('POST', '/px/extField/retire', { panel: PANEL, fieldId: 1 }, probe.token)
check('未授权 POST /px/extField/retire 被 403 拦下', denyRetire.body.code === 403, `code=${denyRetire.body.code} ${denyRetire.body.message}`)

// ---------- ④ 授权后:闸门放行,落到参数校验 ----------
await api('POST', `/sys/role/${roleId}/panels`, { panels: [{ panelCode: PANEL, perms: 'view,field' }] }, admin.token)
const probe2 = await login(PROBE_USER, adminPwd)
check('授权后 fieldPanels 含 QC_INSP_REQ', (probe2.user.fieldPanels || []).includes(PANEL), JSON.stringify(probe2.user.fieldPanels))

const allowAdd = await api('POST', '/px/extField/add', { panel: PANEL, label: '', dataType: '文本', place: 'detail' }, probe2.token)
// 穿过闸门的判据 = **不再是 403**,而是落进 addExtField 的参数校验(400):
// QC_INSP_REQ 是分页签面板,空 label + 空 tab 时先报「请选择所属页签」;换别的面板会先报「字段名必须 1-60」。
// 无论哪条,只要是 400 参数校验就证明权限闸门已放行(403 才是被拦)。
check('授权后穿过权限闸门(403 → 400 参数校验)', allowAdd.body.code === 400,
  `code=${allowAdd.body.code} ${allowAdd.body.message}`)

const allowRetire = await api('POST', '/px/extField/retire', { panel: PANEL, fieldId: 99999999 }, probe2.token)
check('授权后退绑接口同口径放行(落到「字段不存在」)', allowRetire.body.code !== 403
  && String(allowRetire.body.message || '').includes('字段不存在'), `code=${allowRetire.body.code} ${allowRetire.body.message}`)

// 别的面板仍未授权:同一账号换成 PURCHASE_IN 必须依旧 403(逐面板,不是一勾全放开)
const crossPanel = await api('POST', '/px/extField/add', { panel: 'PURCHASE_IN', label: '', dataType: '文本', place: 'detail' }, probe2.token)
check('逐面板生效:未授权的 PURCHASE_IN 仍 403', crossPanel.body.code === 403, `code=${crossPanel.body.code} ${crossPanel.body.message}`)

// ---------- ⑤ 收尾 ----------
const u2 = (await api('GET', '/sys/user/list', undefined, admin.token)).body.data || []
const pu = u2.find((u) => u.userName === PROBE_USER)
if (pu) await api('DELETE', '/sys/user/' + pu.id, undefined, admin.token)
await api('DELETE', '/sys/role/' + roleId, undefined, admin.token)
const left = ((await api('GET', '/sys/user/list', undefined, admin.token)).body.data || []).some((u) => u.userName === PROBE_USER)
  || ((await api('GET', '/sys/role/list', undefined, admin.token)).body.data || []).some((r) => r.roleCode === PROBE_ROLE_CODE)
check('探针账号/角色已清理', !left)

console.log(`\n=== 结果: PASS ${pass} / FAIL ${fail} ===`)
process.exit(fail ? 1 : 0)
