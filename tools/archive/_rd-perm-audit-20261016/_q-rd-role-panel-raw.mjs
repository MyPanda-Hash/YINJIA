/**
 * _q-rd-role-panel-raw.mjs —— yj_role_panel 原样取证(只读,两账套):研发域 + 全局全貌
 *
 * 回答三个问题:
 *   ① 每张 RD_* 面板在每个角色下的 **原始 perms 字符串** 与 **can_approve**(审批还有第二个闸门:
 *      ButtonService.canApprove 读的是 can_approve,不是 perms 里的 audit!)
 *   ② 四个角色在**全库**范围内的授权差异 —— 用来判断"角色之间到底有没有区分度"
 *   ③ 管理员有没有 yj_role_panel 行(没有 = 纯靠 is_admin 兜底;前端菜单过滤是否也认 is_admin 需另证)
 *
 * 用法: node tools/archive/_rd-perm-audit-20261016/_q-rd-role-panel-raw.mjs [--db HSDZ_MES] [--out <file>]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const OUT = arg('out', path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), `role-panel-raw-${DB}.txt`))

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

const L = []
const say = (s = '') => { L.push(s); console.log(s) }

say(`# yj_role_panel 原样取证 —— ${DB}(PROBE 输出,勿手改)`)
say(`# 生成:${new Date().toISOString()}`)
say()

const roles = await q(`SELECT id, role_code, role_name, ISNULL(is_admin,'N') AS is_admin FROM yj_role ORDER BY id`)
say(`## 角色`)
for (const r of roles) say(`id=${r.id} code=${r.role_code} name=${r.role_name} is_admin=${r.is_admin}`)
const roleName = Object.fromEntries(roles.map((r) => [r.id, `${r.role_name}(${r.role_code})`]))
say()

say(`## ① 研发域 RD_* 逐格原样(panel|role|perms|can_approve)`)
const rd = await q(`SELECT panel_code, role_id, ISNULL(perms,'') AS perms, ISNULL(can_approve,'N') AS ca
  FROM yj_role_panel WHERE panel_code LIKE 'RD[_]%' ORDER BY panel_code, role_id`)
say('```')
for (const r of rd) say(`${r.panel_code}\t${roleName[r.role_id] || 'role' + r.role_id}\t${r.perms}\tca=${r.ca}`)
say('```')
say(`行数=${rd.length}`)
say()

say(`## ② 各角色的授权规模`)
for (const r of roles) {
  const n = await q(`SELECT COUNT(*) AS n FROM yj_role_panel WHERE role_id=${r.id}`)
  const nz = await q(`SELECT COUNT(*) AS n FROM yj_role_panel WHERE role_id=${r.id} AND ISNULL(perms,'')<>''`)
  const ca = await q(`SELECT COUNT(*) AS n FROM yj_role_panel WHERE role_id=${r.id} AND can_approve='Y'`)
  say(`- ${roleName[r.id]}: 行=${n[0].n} 非空=${nz[0].n} can_approve=Y=${ca[0].n}`)
}
say()

say(`## ③ 角色两两差集(非管理员的三个角色;字段=面板,值=perms 不同才列出)`)
const nonAdmin = roles.filter((r) => r.is_admin !== 'Y')
const map = {}
for (const r of nonAdmin) {
  const rows = await q(`SELECT panel_code, ISNULL(perms,'') AS perms FROM yj_role_panel WHERE role_id=${r.id}`)
  map[r.id] = Object.fromEntries(rows.map((x) => [x.panel_code, x.perms]))
}
for (let i = 0; i < nonAdmin.length; i++) for (let j = i + 1; j < nonAdmin.length; j++) {
  const a = nonAdmin[i].id, b = nonAdmin[j].id
  const keys = new Set([...Object.keys(map[a]), ...Object.keys(map[b])])
  const diff = [...keys].filter((k) => (map[a][k] || '') !== (map[b][k] || ''))
  say(`- ${roleName[a]} vs ${roleName[b]}:授权规模 ${Object.keys(map[a]).length} / ${Object.keys(map[b]).length},**逐格差异 ${diff.length} 处**`)
  for (const k of diff.slice(0, 40)) say(`    ${k}: [${map[a][k] || '(无行)'}] vs [${map[b][k] || '(无行)'}]`)
  if (diff.length > 40) say(`    …余 ${diff.length - 40} 处`)
}
say()

say(`## ④ 全库授权里出现的词频(引擎认的词打 ✅)`)
const words = await q(`SELECT panel_code, ISNULL(perms,'') AS perms FROM yj_role_panel`)
const PAGE_WORDS = ['date', 'convert', 'assign', 'unassign', 'transfer', 'revoke', 'unclose', 'print', 'close', 'split', 'picking']
const ENGINE = ['view', 'query', 'add', 'modify', 'modlog', 'del', 'export', 'print', 'audit', 'field', 'warn', ...PAGE_WORDS]
const freq = {}
for (const r of words) for (const w of r.perms.split(',')) { const t = w.trim(); if (t) freq[t] = (freq[t] || 0) + 1 }
for (const [w, n] of Object.entries(freq).sort((a, b) => b[1] - a[1]))
  say(`- ${w}${ENGINE.includes(w) ? ' ✅' : ' ❌引擎不认'} × ${n}`)
say()

/* ───── 本次任务的核心证据:两道审批门不同源 ───── */
say(`## ⑥ 两道审批门错位清点(核心证据)`)
say(`门A = ButtonService.canApprove  读 yj_role_panel.can_approve('Y')  → 决定后端 requireApprover 放行 + 前端 approvePanels 显不显示审批按钮`)
say(`门B = PanelPermissionService.requireButton('审核'/'审批通过'/...) 读 perms 含 audit → 在 Controller 入口先拦`)
say()
const mine = await q(`SELECT rp.panel_code, rp.role_id, ISNULL(rp.perms,'') AS perms, ISNULL(rp.can_approve,'N') AS ca
  FROM yj_role_panel rp ORDER BY rp.panel_code, rp.role_id`)
const hasAudit = (p) => p.split(',').map((x) => x.trim()).includes('audit')
const caNotPerm = mine.filter((r) => r.ca === 'Y' && !hasAudit(r.perms))
const permNotCa = mine.filter((r) => r.ca !== 'Y' && hasAudit(r.perms))
say(`- **can_approve='Y' 但 perms 无 audit(前门必 403,前端却显示审批按钮)**:${caNotPerm.length} 处`)
for (const r of caNotPerm) say(`    ${r.panel_code}@${roleName[r.role_id] || r.role_id}  perms=[${r.perms}]`)
say(`- **perms 含 audit 但 can_approve='N'(前门放行、审批按钮不显示 / requireApprover 拦)**:${permNotCa.length} 处`)
for (const r of permNotCa) say(`    ${r.panel_code}@${roleName[r.role_id] || r.role_id}  perms=[${r.perms}]`)
say()

say(`## ⑦ 全部 can_approve='Y' 逐行(不分域)`)
for (const r of mine.filter((x) => x.ca === 'Y'))
  say(`${r.panel_code}\t${roleName[r.role_id] || 'role' + r.role_id}\t${r.perms}\taudit词=${hasAudit(r.perms) ? '有' : '无'}`)
say()

say(`## ⑤ 矩阵勾不到却已授权的词(按面板实际下发的动作集判定)`)
/* ⚠ 2026-10-16 词表归位后:通用面板矩阵列 = 新 11 项(与引擎同源),文件类面板 = 9 项 */
const PERM_ACTIONS_COMMON = ['view', 'query', 'add', 'modify', 'modlog', 'del', 'export', 'print', 'audit', 'field', 'warn']
const FILE_ACTIONS = ['view', 'query', 'add', 'modify', 'modlog', 'del', 'export', 'audit', 'field']
const PAGE_ACTIONS = {
  ORDER_CONVERT: ['view', 'date', 'convert'],
  SCHEDULE_BOARD: ['view', 'assign', 'unassign'],
  WORK_ORDER_BOARD: ['view', 'transfer', 'revoke', 'unclose', 'print'],
  WORK_ORDER_LIST: ['view', 'assign', 'print', 'close', 'split', 'picking'],
}
// 文书归档面板(ButtonService.DOC_ARCHIVE_PANELS)才是文件词集;其余 yj_panel 面板=通用词集
const DOC_ARCHIVE = new Set(['RD_APPROVAL', 'RD_PLAN', 'RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT',
  'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC', 'RD_SPIKE_WATER', 'RD_DOM_TEST', 'RD_EQUIP_USE',
  'RD_INSTR_USE', 'RD_MOLD_PROC', 'RD_MOLD_FORMULA', 'RD_ASM_BOM', 'RD_ASM_PROC', 'RD_SPEC_DOC', 'RD_INSP_PLAN', 'RD_PROD_INFO'])
const actionSetOf = (code) => PAGE_ACTIONS[code] || (DOC_ARCHIVE.has(code) ? FILE_ACTIONS : PERM_ACTIONS_COMMON)
let bad5 = 0
for (const r of mine) {
  const set = actionSetOf(r.panel_code)
  const hidden = r.perms.split(',').map((x) => x.trim()).filter((w) => w && !set.includes(w))
  if (hidden.length) { say(`${r.panel_code}@${roleName[r.role_id]}: 矩阵里没有列的词 [${hidden.join(',')}]`); bad5++ }
}
say(`共 ${bad5} 处`)
say()

await pool.close()
fs.writeFileSync(OUT, L.join('\n'), 'utf8')
console.log(`\n→ 已写出 ${OUT}`)
