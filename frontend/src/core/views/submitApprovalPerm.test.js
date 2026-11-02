/**
 * submitApprovalPerm.test.js —— 「提交审批 ≠ 审批权」的钉子（2026-10-28 用户口径）
 *
 * 【用户原话】「我应该是有没有审批权限都能提交审批。然后我有审批权限才能审批，
 *   而不是当前的没有审批权限不能提交审批……本身拥有审批权限的应该是主管，
 *   没有审批权限的就是普通员工，员工不能提交审批需要主管审批吗？」
 *
 * 【口径】
 *   · 「提交审批」= 编制/发起 ⇒ 有该面板 add / modify 就能提交（管理员恒过）；
 *   · 「审批通过 / 审批驳回」= 审批 ⇒ 仍要 audit 词（+ can_approve），与原来一致；
 *   · 因此「编制与审批分离」只在"批"这一步生效，员工提交不会被审批权绑住。
 *
 * 单测跑不了运行时，按仓库既有做法读源码钉住。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const perms = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java', import.meta.url), 'utf8')
const button = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 取 audit 组那一行的按钮名单（`for (String b : new String[]{"审核", "弃审", ...})`） */
function auditGroupButtons() {
  const at = perms.indexOf('审批类(audit → can_approve')
  assert.ok(at > 0, '找不到审批类注释')
  const seg = perms.slice(at, perms.indexOf('});', at))
  return [...seg.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

test('提交审批不再吃 audit：有编辑权就能提交（管理员恒过）', () => {
  assert.match(perms, /m\.put\("提交审批", new String\[\]\{"add", "modify"\}\)/,
    '「提交审批」必须挂在 add/modify 上')
  const audit = auditGroupButtons()
  assert.ok(!audit.includes('提交审批'),
    '「提交审批」不能留在 audit 组 —— 否则普通员工永远提交不了（2026-10-28 报障）')
})

test('审批通过 / 审批驳回仍归 audit —— 有审批权才能批', () => {
  const audit = auditGroupButtons()
  for (const b of ['审批通过', '审批驳回', '审核', '弃审']) {
    assert.ok(audit.includes(b), `「${b}」必须仍在 audit 组`)
  }
  // 服务端第二道:审批通过仍要求 can_approve（audit 词 → can_approve='Y'）
  assert.match(button, /private void requireApprover\(String panelCode\)[\s\S]{0,200}?canApprove\(currentUserName\(\), panelCode\)/)
})

test('质量单据 / 产品变更申请单不再为「提交审批」单独覆盖（已全局一致）', () => {
  assert.ok(!/RD_CHANGE\|提交审批/.test(perms), 'RD_CHANGE 的提交审批覆盖已无意义，应删掉')
  assert.ok(!/\|\|提交审批/.test(perms) && !/"\|提交审批"/.test(perms), '不应再有「面板|提交审批」覆盖')
  assert.ok(!/SUBMIT_WORDS/.test(perms), 'SUBMIT_WORDS 常量应随覆盖一起删除')
})

test('产品变更申请单仍保留"只有制单人能提交"的身份门禁（不受本次改动影响）', () => {
  assert.match(button, /if \(CHANGE_PANEL\.equals\(def\.code\(\)\)\) \{\s*\n\s*requireChangeInitiator\(no, operator\);/,
    'RD_CHANGE 的身份校验必须还在（词表放开 ≠ 谁都能提交别人的变更单）')
})

test('文案与文档口径：英文词条里仍区分"提交审批 / 审批通过"', () => {
  assert.match(en, /'提交审批':/)
  assert.match(en, /'审批通过':/)
})
