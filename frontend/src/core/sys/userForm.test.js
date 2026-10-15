/**
 * userForm.test.js — 组织架构「新增/编辑用户」的取数口径
 *
 * 钉子(2026-10-15):密码框原先 `v-if="!editingUser"`,编辑保存**永远不动口令** ——
 * 前端有、后端有、中间被一个 v-if 掐断,静默失效谁都不报错。
 * 这组用例把「什么时候发 password、什么时候必须拦」钉死。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUserSaveBody, emptyUserForm, toSwitchEnabled, PWD_MIN } from './userForm.js'

const base = (over = {}) => ({ ...emptyUserForm(), userName: 'cp', realName: '陈秀丽', ...over })

test('新建:带口令 → ok,body 带 password、不带 id、不带 resetPassword', () => {
  const r = buildUserSaveBody(base({ password: 'Abc12345' }), null)
  assert.equal(r.ok, true)
  assert.equal(r.body.password, 'Abc12345')
  assert.equal('id' in r.body, false, '新建不该下发 id')
  assert.equal('resetPassword' in r.body, false, '开关是界面态,不该进请求体')
  assert.equal(r.body.userName, 'cp')
})

test('新建:口令留空 → 拦下(新建必须设口令)', () => {
  assert.deepEqual(buildUserSaveBody(base({ password: '' }), null), { ok: false, reason: 'needPassword' })
})

test('新建:口令不足 6 位 → 拦下', () => {
  assert.deepEqual(buildUserSaveBody(base({ password: 'a'.repeat(PWD_MIN - 1) }), null),
    { ok: false, reason: 'tooShort' })
})

test('编辑:不勾「重置密码」→ 发空 password(后端据此保留原口令)', () => {
  const r = buildUserSaveBody(base({ password: '', resetPassword: false }), 16)
  assert.equal(r.ok, true)
  assert.equal(r.body.id, 16)
  assert.equal(r.body.password, '', '不重置时必须发空串,绝不能把界面里的残留值发出去')
})

test('编辑:勾了「重置密码」+ 新口令 → ok,body 带新口令与 id  ← 本次要补的能力', () => {
  const r = buildUserSaveBody(base({ password: 'NewPass1', resetPassword: true }), 16)
  assert.equal(r.ok, true)
  assert.equal(r.body.id, 16)
  assert.equal(r.body.password, 'NewPass1')
})

test('编辑:勾了「重置密码」但留空 → 拦下(不能静默不生效)', () => {
  assert.deepEqual(buildUserSaveBody(base({ password: '', resetPassword: true }), 16),
    { ok: false, reason: 'needPassword' })
})

test('编辑:勾了「重置密码」但不足 6 位 → 拦下', () => {
  assert.deepEqual(buildUserSaveBody(base({ password: 'a'.repeat(PWD_MIN - 1), resetPassword: true }), 16),
    { ok: false, reason: 'tooShort' })
})

test('编辑:不勾重置时,界面里残留的口令值不会漏发', () => {
  const r = buildUserSaveBody(base({ password: 'LeftOver', resetPassword: false }), 16)
  assert.equal(r.ok, true)
  assert.equal(r.body.password, '', '残留值必须被清成空串')
})

test('账号为空 → 拦下(新建/编辑都拦)', () => {
  assert.deepEqual(buildUserSaveBody(base({ userName: '   ' }), null), { ok: false, reason: 'needUserName' })
  assert.deepEqual(buildUserSaveBody(base({ userName: '', resetPassword: false }), 16),
    { ok: false, reason: 'needUserName' })
})

test('全字段覆盖口径:其余字段原样透传(password 之外一个都不能少)', () => {
  const r = buildUserSaveBody(base({
    password: '', resetPassword: false, realName: '陈秀丽', deptId: 8, roleId: 4, workshop: '一车间', enabled: 1,
  }), 16)
  assert.equal(r.ok, true)
  assert.deepEqual(
    { u: r.body.userName, n: r.body.realName, d: r.body.deptId, ro: r.body.roleId, w: r.body.workshop, e: r.body.enabled },
    { u: 'cp', n: '陈秀丽', d: 8, ro: 4, w: '一车间', e: 1 },
  )
})

// ── enabled 口径(2026-10-15 探针实测抓到的既存 bug)────────────────────────────
// /sys/user/list 返回 enabled 是**字符串** "1",而 el-switch 的 active/inactive 是**数字** —— 不归一的话,
// 打开启用中账号的编辑弹窗会显示成「关」,管理员只想改个密码一保存就把账号停用了(实测 enabled 1→0)。
test('toSwitchEnabled:接口的字符串 "1"/"0" 必须归成数字,否则开关显示成"关"', () => {
  assert.equal(toSwitchEnabled('1'), 1)
  assert.equal(toSwitchEnabled('0'), 0)
  assert.equal(toSwitchEnabled(1), 1)
  assert.equal(toSwitchEnabled(0), 0)
})

test('toSwitchEnabled:缺值/null 视为启用(与新建默认一致)', () => {
  assert.equal(toSwitchEnabled(undefined), 1)
  assert.equal(toSwitchEnabled(null), 1)
  assert.equal(toSwitchEnabled(''), 1)
})

test('请求体里的 enabled 必须是数字 0/1(后端与 el-switch 同口径)', () => {
  assert.equal(buildUserSaveBody(base({ enabled: '1' }), 16).body.enabled, 1)
  assert.equal(buildUserSaveBody(base({ enabled: '0' }), 16).body.enabled, 0)
  assert.equal(buildUserSaveBody(base({ enabled: 0 }), 16).body.enabled, 0)
})
