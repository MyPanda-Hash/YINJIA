/**
 * _q-rd-perm-matrix.mjs —— 研发管理域「角色×面板×权限词」现状取证(只读,不写库)
 *
 * 为什么要有它:用户口径「组织架构里面的研发管理模块角色可配置的权限与现在的面板功能是对不上的」。
 * 需要三份事实对齐:
 *   ① 组织架构矩阵里**能勾什么**(SysAdminController 下发的 actions;文件类=FILE_PANEL_ACTIONS,其余=PERMISSION_ACTIONS)
 *   ② 库里**已勾了什么**(yj_role_panel.perms)
 *   ③ 面板上**实际有什么按钮**、这些按钮在引擎里吃哪个词(PanelPermissionService.BUTTON_PERMS / OVERRIDE)
 * ②③对不上 = 勾了也没用;①③没有交集 = 想勾都勾不到(改不了/删不了)。
 *
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-rd-perm-matrix.mjs [baseUrl] [outFile]
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const OUT = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'rd-perm-matrix.md')

const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {}),
})).json())
const get = async (p, token) => (await (await fetch(BASE + p, {
  headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) },
})).json())

/* ── 引擎真源:PanelPermissionService.BUTTON_PERMS + BUTTON_PERMS_OVERRIDE(逐字照抄) ── */
const ENGINE_WORDS = ['view', 'query', 'add', 'modify', 'modlog', 'del', 'export', 'print', 'audit', 'field', 'warn']
const BUTTON_PERMS = {}
for (const b of ['刷新', '查找', '审批情况', '同步进度', '终止审批通过', '终止审批驳回', '完成', '修改', '删除记录']) BUTTON_PERMS[b] = ['view']
BUTTON_PERMS['修改记录'] = ['view', 'modlog']
for (const b of ['保存', '提交', '保存新增', '保存为草稿', '新增流程', '新增', '复制', '阶段完成', '生成产品批号',
  '新增库存', '产品开发', '申请终止', '更新预警数量', '首件完成通知', '生成采购申请']) BUTTON_PERMS[b] = ['add', 'modify']
BUTTON_PERMS['设置预警数量'] = ['warn']
BUTTON_PERMS['预警配置'] = ['warn']
BUTTON_PERMS['申请修改'] = ['modify']
BUTTON_PERMS['删除'] = ['add', 'modify', 'del']
BUTTON_PERMS['删除单据'] = ['add', 'modify', 'del']
BUTTON_PERMS['撤回删除申请'] = ['del', 'audit']
BUTTON_PERMS['撤回修改申请'] = ['modify', 'audit']
BUTTON_PERMS['撤回终止申请'] = ['modify', 'audit']
for (const b of ['审核', '弃审', '提交审批', '审批通过', '审批驳回', '中止', '取消中止', '项目定级',
  '删除审批通过', '删除审批驳回', '修改审批通过', '修改审批驳回']) BUTTON_PERMS[b] = ['audit']
const OVERRIDE = {
  'RD_CHANGE|提交审批': ['add', 'modify'], 'RD_CHANGE|提交会签': ['add', 'modify'],
  'RD_CHANGE|撤回会签': ['add', 'modify', 'audit'],
  'RD_CHANGE|会签通过': ['view'], 'RD_CHANGE|会签驳回': ['view'],
}
for (const p of ['RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN']) OVERRIDE[p + '|弃审'] = ['add', 'modify', 'audit']
const needOf = (panel, btn) => OVERRIDE[panel + '|' + btn] || BUTTON_PERMS[btn] || null

/* ── 组织架构矩阵下发的动作集(逐字照抄 SysAdminController;2026-10-16 词表归位后的 11 项) ── */
const PERMISSION_ACTIONS = [['view', '可见'], ['query', '查询单据'], ['add', '新增保存'], ['modify', '申请修改'],
  ['modlog', '修改记录'], ['del', '删除申请'], ['export', '导出打印'], ['print', '打印预览'], ['audit', '审批'],
  ['field', '自定义字段'], ['warn', '预警配置']]
const FILE_PANEL_ACTIONS = [['view', '可见'], ['query', '查询单据'], ['add', '新增保存'], ['modify', '申请修改'],
  ['modlog', '修改记录'], ['del', '删除申请'], ['export', '导出打印'], ['audit', '审批'], ['field', '自定义字段']]

const L = []
const say = (s = '') => { L.push(s); console.log(s) }

const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 160)); process.exit(1) }
const token = lg.data.token
say(`# 研发管理域 角色×面板×权限词 现状(PROBE 输出,勿手改)`)
say()
say(`- 来源:${BASE}`)
say(`- 生成:${new Date().toISOString()}`)
say()

const rl = await get('/sys/role/list', token)
const roles = rl?.data || []
say(`## 角色(${roles.length})`)
say()
for (const r of roles) say(`- id=${r.id} code=${r.roleCode} name=${r.roleName} isAdmin=${r.isAdmin}`)
say()

const rows = []
for (const r of roles) {
  const rp = await get(`/sys/role/${r.id}/panels`, token)
  const d = rp?.data || {}
  const mods = d.modules || []
  const rd = mods.find((m) => m.code === '研发管理') || mods.find((m) => (m.panels || []).some((p) => String(p.panelCode).startsWith('RD_')))
  if (!rd) continue
  const granted = {}
  for (const g of (d.granted || [])) granted[g.panelCode] = g.perms || ''
  for (const p of (rd.panels || [])) {
    rows.push({ role: r.roleName, roleCode: r.roleCode, panel: p.panelCode, panelName: p.panelName,
      actions: (p.actions || []).map((a) => a[0]),
      granted: Object.prototype.hasOwnProperty.call(granted, p.panelCode) ? granted[p.panelCode] : null })
  }
}
const rdPanels = [...new Set(rows.map((x) => x.panel))]
const roleNames = [...new Set(rows.map((x) => `${x.roleCode}/${x.role}`))]

say(`## 研发管理域面板(${rdPanels.length})× 角色(${roleNames.length}) —— 矩阵可勾词 / 库内已勾词`)
say()
say('| 面板 | 面板名 | 矩阵词集 | ' + roleNames.map((n) => n.split('/')[1]).join(' | ') + ' |')
say('|---|---|---|' + roleNames.map(() => '---').join('|') + '|')
for (const panel of rdPanels) {
  const first = rows.find((x) => x.panel === panel)
  const isFile = first.actions.includes('modlog')
  const cells = roleNames.map((n) => {
    const r0 = rows.find((x) => x.panel === panel && `${x.roleCode}/${x.role}` === n)
    const g = r0 ? r0.granted : null
    if (g === null) return '—(无行)'
    return g === '' ? '(空)' : g
  })
  say(`| ${panel} | ${first.panelName} | ${isFile ? '文件类9' : '通用13'} | ${cells.join(' | ')} |`)
}
say()

/* ③ 面板真实按钮 + 引擎词 */
say(`## 面板真实按钮 → 引擎所需词(来自 getPanelConfig;未映射=放行)`)
say()
for (const panel of rdPanels) {
  const cf = await get(`/px/getPanelConfig?panelCode=${encodeURIComponent(panel)}`, token)
  const md = cf?.data?.metadata && Object.keys(cf.data.metadata).length ? cf.data.metadata : (cf?.data || {})
  const btns = []
  // 本引擎里 buttonGroups[].actions 存的就是**按钮名**(group(组名, [按钮名...]));panelButtons[].buttonName 同义
  for (const g of (md.buttonGroups || [])) for (const b of (g.actions || [])) btns.push(b)
  for (const b of (md.panelButtons || [])) btns.push(b.buttonName || b.name || b)
  const uniq = [...new Set(btns.filter((x) => typeof x === 'string'))]
  say(`### ${panel}`)
  for (const b of uniq) {
    const need = needOf(panel, b)
    say(`- ${b} → ${need ? need.join('|') : '(未映射=放行)'}`)
  }
  if (!uniq.length) say(`- (配置未返回按钮列表;md keys: ${Object.keys(md).join(',')})`)
  say()
}

/* ── 结论块 ── */
say(`## 自动判定`)
say()
const inert = PERMISSION_ACTIONS.map((a) => a[0]).filter((w) => !ENGINE_WORDS.includes(w))
say(`- **矩阵通用 13 项里引擎不认的词**:${inert.join(', ')} —— 勾了等于没勾(引擎只读 ${ENGINE_WORDS.join('/')})`)
const needed = ['modify', 'del', 'modlog']
say(`- **引擎需要但通用矩阵勾不到的词**:${needed.filter((w) => !PERMISSION_ACTIONS.some((a) => a[0] === w)).join(', ')}`)
say(`  ⇒ 非文件类面板(通用 13 项)永远授不出「申请修改/修改记录/删除申请」,普通角色点「修改/删除」必 403。`)
say()
const noRow = []
const unvis = []
for (const panel of rdPanels) for (const n of roleNames) {
  const r0 = rows.find((x) => x.panel === panel && `${x.roleCode}/${x.role}` === n)
  if (!r0) continue
  if (r0.granted === null || r0.granted === '') noRow.push(`${panel}@${n}`)
  const words = (r0.granted || '').split(',').filter(Boolean)
  const hidden = words.filter((w) => !r0.actions.includes(w))
  if (hidden.length) unvis.push(`${panel}@${n.split('/')[1]} 有 [${hidden.join(',')}] 但矩阵勾不到`)
}
say(`- **库里没授权(无行/空词)**:${noRow.length} 处`)
say(`  ${noRow.slice(0, 80).join(' , ')}${noRow.length > 80 ? ' …' : ''}`)
say()
say(`- **库里已勾、但组织架构矩阵根本没有这一列(看不见/点不掉)**:${unvis.length} 处`)
for (const u of unvis) say(`  - ${u}`)
say()

fs.writeFileSync(OUT, L.join('\n'), 'utf8')
console.log(`\n→ 已写出 ${OUT}`)
