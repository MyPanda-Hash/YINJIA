/**
 * selfAudit.test.js —— 「本人自审」权限的钉子（2026-10-28 用户口径）
 *
 * 【用户原话】「当前需要实现本人可以提出审核后自己审核确认，增加一个这个权限设置，
 *   保留原来的本人提交审核后不能本人自己审核的逻辑」
 *
 * 【口径】
 *   · 新词 = 面板级动作词 `selfaudit`（组织架构 → 角色与面板权限里的「本人自审」列）；
 *   · 只**解除**「编制与审批分离」对本人提交单的限制，**不等于审批权** —— requireApprover 仍要过；
 *   · 默认没有该词 ⇒ 原逻辑一字不动（拒）；
 *   · 放行时必须留痕 self_audit='Y'（审批情况显示「自审」），不能悄悄混进正常审批；
 *   · 只管一级审批；二级审批人仍不能是提交人。
 *
 * 单测跑不了运行时，按仓库既有做法读源码钉住（同 approvalSeparation.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const button = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const sys = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/SysAdminController.java', import.meta.url), 'utf8')
const permSvc = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java', import.meta.url), 'utf8')
const authCtl = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/AuthController.java', import.meta.url), 'utf8')
const store = readFileSync(new URL('../../stores/user.js', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const history = readFileSync(new URL('./ApprovalHistoryDialog.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../../../tools/migrate-form-approval-self-audit-20261028.sql', import.meta.url), 'utf8')
const manifest = readFileSync(new URL('../../../../tools/db-migrations.txt', import.meta.url), 'utf8')

test('权限词 selfaudit 同时出现在「通用动作集 / 文书面板动作集 / 引擎词表」', () => {
  for (const constName of ['PERMISSION_ACTIONS', 'FILE_PANEL_ACTIONS']) {
    const at = sys.indexOf(`String[][] ${constName} = {`)
    assert.ok(at > 0, `SysAdminController 里找不到 ${constName}`)
    const block = sys.slice(at, sys.indexOf('};', at))
    assert.match(block, /\{\s*"selfaudit"\s*,\s*"本人自审"\s*\}/,
      `${constName} 缺 selfaudit ⇒ 矩阵里没法勾，权限授不出去`)
  }
  assert.match(permSvc, /Map\.entry\("selfaudit", "本人自审"\)/,
    'PERM_LABEL 缺 selfaudit ⇒ 403 提示与矩阵列头对不上')
})

test('默认保留原逻辑：没有 selfaudit 词时，提交人自己审批仍然被拒', () => {
  assert.match(button, /boolean selfAudit = !isAdminUser\(operator\) && operator\.equals\(submitter\) && canSelfAudit\(operator, def\.code\(\)\);/,
    '自审判定必须先是「我是提交人」再问权限词')
  assert.match(button, /if \(!isAdminUser\(operator\) && operator\.equals\(submitter\) && !selfAudit\)\s*\n\s*throw new org\.springframework\.security\.access\.AccessDeniedException\(\s*\n\s*"审批人不能与提交人相同（编制与审批分离）/,
    '未授权时必须仍走这条拒绝分支（原逻辑一字不动）')
})

test('「审批通过」:自审不等于审批权,requireApprover 仍在自审判定之前', () => {
  const iApprover = button.indexOf('requireApprover(def.code());')
  const iSelf = button.indexOf('boolean selfAudit =', iApprover)
  assert.ok(iApprover > 0 && iSelf > iApprover,
    '顺序必须是 先 requireApprover 再判 selfaudit —— 否则只勾「本人自审」就能审任何单')
})

/**
 * 2026-11-13 用户口径追加:「本人自审权限绑定审核按钮」。
 * 之前的规则是「selfaudit 只解除编制与审批分离,审批权照旧要过」—— 结果只勾了「本人自审」的角色
 * 连**自己制的单**都点不动(接口层 403 + 前端按钮整颗不渲染),权限授了等于没授。
 * 现在:审核按钮对「自审权」开放,但**只对本人制的单**;别人的单仍要求审批权。
 */
test('审核:自审权只替代「本人制的单」的审批权,别人的单仍然要 audit', () => {
  const iAudit = button.indexOf('private Map<String, Object> audit(PanelRegistry.PanelDef def')
  assert.ok(iAudit > 0, '找不到 audit()')
  const body = button.slice(iAudit, iAudit + 6000)
  assert.match(body, /boolean hasApprove = canApprove\(auditor, def\.code\(\)\);/,
    'audit() 必须先算出有没有审批权(不抛异常)')
  assert.ok(!/if \(!def\.isDoc\(\)\)[\s\S]{0,80}requireApprover\(def\.code\(\)\)/.test(body)
    && !/^\s*requireApprover\(def\.code\(\)\);\s*$/m.test(body),
    'audit() 里不能再无条件 requireApprover —— 那样自审权永远用不上')
  assert.match(body, /if \(!hasApprove && !selfGranted\)/,
    '闸门必须是「既没审批权、又不是本人自审」才拒')
  assert.match(body, /if \(byAuthor && !admin && !selfGranted\)/,
    '原有「编制与审批分离」拒绝分支必须保留(未授自审仍拒)')
  assert.match(body, /boolean selfGranted = byAuthor && canSelfAudit\(auditor, def\.code\(\)\);/,
    'selfGranted 只能是「本人制的单 + 有自审词」')
})

test('接口层:只有「审核/审批通过/审批驳回」允许 selfaudit 放行,别扩大到弃审/中止', () => {
  assert.match(permSvc, /SELF_AUDIT_ACTIONS = Set\.of\("审核", "审批通过", "审批驳回"\)/,
    '白名单必须是这三颗 —— 服务层只有它们带 canSelfAudit 判据')
  assert.match(permSvc, /if \(perms\.contains\("selfaudit"\) && SELF_AUDIT_ACTIONS\.contains\(buttonName\)\) return;/,
    'requireButton 里要有这条放行,否则接口先 403,按钮点了必报错')
})

test('前端:「审核」按钮对自审权开放(只扩这一颗,不扩审批组)', () => {
  assert.match(panelx, /function canAuditHere\(\) \{\s*\n\s*return canApproveHere\(\) \|\| canSelfAuditHere\(\)/,
    'canAuditHere = 审批权 ∪ 自审权')
  assert.match(panelx, /v-if="canAuditHere\(\)"/, '审核按钮的 v-if 要用 canAuditHere')
  // 审批通过/驳回组仍由 canApproveHere（∪ 二级审批人）决定 —— 自审权不能把审批权带出来
  assert.match(panelx, /const approvalBtnsVisible = computed\(\(\) =>[\s\S]{0,300}canApproveHere\(\)/,
    '审批组显隐仍是 canApproveHere，不能挂 canAuditHere')
  const auditUses = (panelx.match(/canAuditHere\(\)/g) || []).length
  assert.equal(auditUses, 2, `canAuditHere 只应出现 2 次(定义 + 审核按钮 v-if),实际 ${auditUses} 次 —— 别扩到别的按钮`)
})

test('自审留痕：写 self_audit=Y，审批情况查询回 selfAudit', () => {
  assert.match(button, /INSERT INTO yj_form_approval \(panel_code, form_no, action, result, node_no, operator, opinion, self_audit, create_time\)/,
    '留痕 INSERT 必须带 self_audit 列')
  assert.match(button, /recordApproval\(def\.code\(\), no, "APPROVE", "APPROVED", opinion, 1, selfAudit\);/,
    '单节点「审批通过」必须把 selfAudit 传进留痕')
  assert.match(button, /recordApproval\(def\.code\(\), no, "APPROVE_L1", "L1_PASSED", opinion, 1, selfAudit\);/,
    '两级面板的一级通过同样要标记')
  assert.match(button, /m\.put\("selfAudit", "Y"\.equals\(rs\.getString\("self_audit"\)\)\)/,
    'queryApprovalHistory 必须把 self_audit 带出去，否则前端无从显示')
})

test('二级审批不受影响：二级审核人仍不能是提交人', () => {
  assert.match(button, /if \(!isAdminUser\(operator\) && l2\.equals\(submitter\)\)\s*\n\s*throw new IllegalStateException\("二级审核人不能是提交人本人（编制与审批分离）/,
    '自审只开一级；二级选人这条必须原样保留')
})

test('前端消费 selfAuditPanels：store 下发 → 列表页不再按提交人自我排除 → 审批情况显示「自审」', () => {
  assert.match(store, /selfAuditPanels: Array\.isArray\(ui\?\.selfAuditPanels\) \? ui\.selfAuditPanels : \[\]/)
  assert.match(store, /this\.selfAuditPanels = Array\.isArray\(u\?\.selfAuditPanels\)/)
  assert.match(authCtl, /user\.put\("selfAuditPanels", selfAuditPanelsFull\(admin, u\.get\("role_id"\), username\)\)/)
  assert.match(panelx, /function canSelfAuditHere\(\)/)
  assert.match(panelx, /if \(canSelfAuditHere\(\)\) return false/)
  assert.match(history, /v-if="row\.selfAudit"/)
  assert.match(en, /'本人自审': 'Self-approval'/)
})

// ── 2026-10-28 追加:单人审批兜底(用户口径「我既然拥有审批权限我就应该能审批」) ──
test('单人审批兜底:该面板除我之外没有别的启用审批人 ⇒ 允许自审(服务端与下发同源)', () => {
  assert.match(button, /Integer others = jdbc\.queryForObject\(\s*\n\s*"SELECT COUNT\(DISTINCT o\.username\) FROM yj_role_panel rp2"/,
    'canSelfAudit 必须有「其他审批人」计数')
  assert.match(button, /AND o\.username <> \? AND o\.is_admin = 'N'/,
    '排除自己、排除管理员(管理员本就豁免)')
  assert.match(button, /ISNULL\(o\.enabled,1\) = 1 AND ISNULL\(o\.asp_cancel,'N'\) <> 'Y'/,
    '只数**启用且未作废**的审批人')
  assert.match(button, /if \(TWO_LEVEL_PANELS\.contains\(panelCode\)\) return false;/,
    '两级面板不兜底(它们本就有第二级,不存在死路)')
  assert.match(authCtl, /private List<String> onlyApproverPanels\(String username\)/)
  assert.match(authCtl, /out\.addAll\(onlyApproverPanels\(username\)\)/,
    '下发给前端的 selfAuditPanels 必须并上「我是唯一审批人」的面板,否则前端仍会置灰')
  assert.match(authCtl, /twoLevel\.add\("RD_PROD_INFO"\);/, '下发也要排除两级面板')
})

test('数据侧：迁移已登记且写的是幂等加列', () => {
  assert.ok(manifest.includes('migrate-form-approval-self-audit-20261028.sql'), 'tools/db-migrations.txt 未登记迁移')
  assert.match(migration, /IF COL_LENGTH\('dbo\.yj_form_approval', 'self_audit'\) IS NULL/)
  assert.match(migration, /sp_addextendedproperty[\s\S]{0,400}self_audit/)
})
