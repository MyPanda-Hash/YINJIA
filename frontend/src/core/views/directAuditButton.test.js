/**
 * directAuditButton.test.js —— 「审核」提为单据工具栏一级按钮的钉子(2026-11-13 用户口径)
 *
 * 【用户原话】
 *   「这个审批要有个审核按钮,否则对自填自审的角色来说,操作过于麻烦。单据的按钮界面都需要加上这个按钮。
 *    然后只有有审核权限的角色,并且没有提交审批状态的单据才可以点击这个按钮。
 *    如果已经提交审核了,就正常用审批通过来就行,不能点击审核按钮。」
 *
 * 【为什么要钉】三处口径分居三个文件、四条判据(显隐 / 置灰 / 说明 / 服务端),少一处就会退化成
 *   「点得到但被拒」或「有权限却看不见」:
 *     · 显隐  = filterGroups(有该面板审批权才出现;不再是"仅管理员")
 *     · 位置  = toolbarGroups 末尾 .reduce(hoistDirectAudit) —— 从「审批 ▼」下拉里提出来单独一颗
 *     · 置灰  = isDisabled(仅草稿/修改中 + 非两级审批面板)
 *     · 服务端 = ButtonService.audit():requireApprover(取代"仅管理员") + canSelfAudit(与审批通过同口径)
 *   单测跑不了运行时,按仓库既有做法读源码钉住(同 approvalSeparation.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const buttonService = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('显隐:有审批权才出现「审核」,不再仅管理员', () => {
  assert.match(panelx, /const DIRECT_AUDIT_ACTION = '审核'/, '面板码/动作名要收成一个常量,避免字符串散落')
  const body = panelx.match(/function filterGroups\(raw\) \{[\s\S]{0,900}?\n\}/)
  assert.ok(body, '找不到 filterGroups')
  assert.match(body[0], /if \(!canApprove\) actions = actions\.filter\(\(a\) => a !== DIRECT_AUDIT_ACTION/,
    '「审核」必须和审批通过/驳回走同一条显隐规则(无审批权即不出现)')
  assert.ok(!/ADMIN_ONLY_ACTIONS/.test(panelx), '2026-09-22「直审仅管理员」的旧闸门不能留在列表页')
})

test('位置:从「审批 ▼」下拉里提出来,单独成一颗工具栏按钮(紧挨审批左边)', () => {
  assert.match(panelx, /\.reduce\(hoistDirectAudit, \[\]\)\)/, 'toolbarGroups 末尾必须做一次 hoist')
  const body = panelx.match(/function hoistDirectAudit\(out, group\) \{[\s\S]{0,900}?\n\}/)
  assert.ok(body, '找不到 hoistDirectAudit')
  assert.match(body[0], /out\.push\(\{ name: DIRECT_AUDIT_ACTION, actions: \[DIRECT_AUDIT_ACTION\] \}\)/,
    '提出来要单独成组(只有「审核」一个动作 ⇒ 主按钮点了就审,不带 ▼)')
  assert.match(body[0], /const rest = actions\.filter\(\(a\) => a !== DIRECT_AUDIT_ACTION\)/,
    '原「审批」组要去掉「审核」,否则下拉与主按钮重复')
})

test('置灰:只有「没提交审批」的单据可点(草稿/修改中),两级审批面板恒灰', () => {
  const body = panelx.match(/审核: [^\n]*\n/)
  assert.ok(body, '找不到 isDisabled 里的 审核 判定')
  assert.match(body[0], /\['草稿', '修改中'\]\.includes\(st\)/, '可点的两档 = 草稿 / 修改中(未提交审批)')
  assert.match(body[0], /isDirectAuditBlocked\.value/, '两级审批面板要恒灰(后端一步跨不过第二级)')
  assert.match(panelx, /const DIRECT_AUDIT_BLOCKED = \[[\s\S]{0,500}?'RD_PROD_INFO', 'RD_SAMPLE_EXT'/,
    '名单必须与后端 ADMIN_L2_PANELS + TWO_LEVEL_PANELS 对齐')
})

test('点不动时给出人话原因(已提交审批 → 请用审批通过)', () => {
  const body = panelx.match(/if \(action === DIRECT_AUDIT_ACTION\) \{[\s\S]{0,700}?\n  \}/)
  assert.ok(body, 'disabledReason 里缺 审核 分支')
  assert.match(body[0], /IN_APPROVAL\.includes\(st\)/, '已提交审批(审批中/待二级审批)要单独一档说明')
  assert.match(en, /'该单已提交审批：请用「审批通过」完成审批，不能再点「审核」':/,
    '切英文不能回落中文')
  assert.match(en, /'该单走两级审批：请用「提交审批」→「审批通过」逐级签核，不能直接审核':/)
  assert.match(en, /'审核：一步到位（草稿 → 已审核），不需要再走提交审批':/)
})

test('服务端:audit() 由 requireApprover 把门,自审豁免与「审批通过」同一份 canSelfAudit', () => {
  const start = buttonService.indexOf('private Map<String, Object> audit(PanelRegistry.PanelDef def')
  assert.ok(start > 0, '找不到 audit()')
  const body = buttonService.slice(start, start + 9000)
  assert.match(body, /requireApprover\(def\.code\(\)\);/, '权限 = 该面板 can_approve ∪ 管理员(与审批通过同口径)')
  assert.ok(!/仅管理员可直接审核/.test(body), '「仅管理员可直接审核」的硬拒必须去掉')
  assert.ok(!/仅管理员可直接审核/.test(buttonService), '整份 ButtonService 都不该再留那句硬拒')
  assert.match(body, /canSelfAudit\(auditor, def\.code\(\)\)/, '自填自审角色靠它豁免「编制与审批分离」')
  assert.match(body, /TWO_LEVEL_PANELS\.contains\(def\.code\(\)\)/, '两级面板仍不许直审')
  assert.match(body, /"该单已提交审批：请用「审批通过」完成审批，不能直接「审核」"/,
    '已提交审批的单据必须引导到审批通过(用户口径原话)')
  assert.match(body, /recordApproval\(def\.code\(\), no, "AUDIT", "APPROVED", auditOpinionOf\(formData\), 1, selfAudit\)/,
    '直审留痕要带自审标记(审批情况里显示「自审」)')
})
