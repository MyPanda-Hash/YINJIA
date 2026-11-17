/**
 * 会签通过 → 自动给"该会签人所属部门"的纸面行盖「签字 + 日期」
 * （2026-11-17 用户口径 A：「点通过即在该部门行写"签字+日期",内容留空(或写"/")」）
 *
 * 背景：此前只有 stampSignature 一条路 —— **填了「变更后内容」并保存**才盖章。
 * 会签人只点「会签通过」不填内容时，纸面「三、部门评审意见」他那一行永远停在「/ /」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const svc = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

test('会签通过时必须调用 stampSignoffDeptRow', () => {
  const at = svc.indexOf('private Map<String, Object> signoffApprove(')
  assert.ok(at > 0, '缺 signoffApprove')
  // 取到方法结束（下一个 private Map 方法前）
  const seg = svc.slice(at, svc.indexOf('/** 会签驳回', at))
  assert.match(seg, /stampSignoffDeptRow\(def, no, user\)/,
    '会签通过后必须盖部门行章')
})

test('盖章只写 签字/日期，不动 变更后内容', () => {
  const at = svc.indexOf('private void stampSignoffDeptRow(')
  assert.ok(at > 0, '缺 stampSignoffDeptRow')
  const seg = svc.slice(at, at + 2600)
  assert.match(seg, /SET 签字 = \?, 日期 = \?/, 'SQL 只应更新 签字/日期')
  assert.doesNotMatch(seg, /SET[^;]*变更后内容/, '不得改写「变更后内容」（没给意见就让它空着）')
  // 幂等：不能刷掉别人的签名
  assert.match(seg, /ISNULL\(签字, N''\) = N'' OR 签字 = \?/, '只更新空签名或本人的行，不能覆盖他人')
})

test('部门映射复用 changeDeptsOf；无映射时静默跳过、不阻断会签', () => {
  const at = svc.indexOf('private void stampSignoffDeptRow(')
  const seg = svc.slice(at, at + 2600)
  assert.match(seg, /changeDeptsOf\(user\)/, '必须复用既有映射口径（yj_user.dept_id → yj_change_dept）')
  assert.match(seg, /depts\.isEmpty\(\)\) return;/, '查不到部门应静默返回，不能把人卡住')
  assert.match(seg, /catch \(Exception e\)/, '盖章异常不得拖垮会签')
  assert.match(seg, /CHANGE_DEPT_SECTION/, '只能盖「部门评审意见」表区的行')
})

test('驳回不盖章（驳回不该留签名）', () => {
  const at = svc.indexOf('private Map<String, Object> signoffReject(')
  assert.ok(at > 0)
  const seg = svc.slice(at, svc.indexOf('/** 撤回会签', at))
  assert.doesNotMatch(seg, /stampSignoffDeptRow/, '驳回路径不得盖章')
})
