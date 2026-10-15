/**
 * 组织架构·用户表单 → /sys/user/save 请求体的唯一真源。
 *
 * 为什么要有它(2026-10-15):「管理员重置他人密码」在界面上**做不到** ——
 * OrgAdmin.vue 的密码输入框写着 `v-if="!editingUser"`(只有新建才出现),
 * 编辑时 userForm.password 恒为空串,而后端 SysAdminService:148 是
 * `if (!password.isBlank())` 才改 password_hash ⇒ 编辑保存**永远不动口令**。
 * 前端有、后端有、中间那条路被一个 v-if 掐断,谁都没报错。
 *
 * 收敛成纯函数的好处:新增密码框/开关时,「什么时候该发 password、什么时候必须拦」
 * 有单测兜着,不会再靠"看模板"判断(模板里一个 v-if 就能静默废掉整条能力)。
 *
 * ⚠ /sys/user/save 是**全字段覆盖**(SET real_name=?, dept_id=?, role_id=?, enabled=?,
 *   is_admin=?, 生产车间=?, [password_hash=?]),漏发一个就清空一个;
 *   is_admin 由后端按 roleId 反查(不下发),故本函数不出该键。
 */

/** 密码最短长度(与后端 AuthController/changePassword、SysAdminService 的口径一致) */
export const PWD_MIN = 6

/** 失败原因码 → 需要 tt() 的中文标签(视图层再翻,保持 i18n 唯一出口)。
 *  三条都用**已有的**译名(见 locales: '请输入账号' / '请输入密码' / '至少 6 位'),不新增文案。 */
export const REASON_LABEL = {
  needUserName: '请输入账号',
  needPassword: '请输入密码',
  tooShort: '至少 6 位',
}

/**
 * el-switch 口径归一:`/sys/user/list` 返回的 enabled 是**字符串** "1"/"0",
 * 而弹窗里 `el-switch :active-value="1" :inactive-value="0"` 认的是**数字** ——
 * "1" !== 1 ⇒ 启用中的账号打开编辑弹窗时开关显示成「关」,一保存就把账号停用。
 */
export function toSwitchEnabled(v) {
  // 空值一律按「启用」(与新建默认一致);其余按数字判 0 —— 这样 "0"/0 才是停用
  if (v === null || v === undefined || v === '') return 1
  return Number(v) === 0 ? 0 : 1
}

/** 空表单(新建用) */
export function emptyUserForm() {
  return {
    userName: '', realName: '', password: '',
    deptId: null, roleId: null, workshop: '', enabled: 1,
    /** 编辑态专用:勾上才发 password;新建态忽略它 */
    resetPassword: false,
  }
}

/**
 * 表单 → 请求体。
 * @param {object} form    userForm
 * @param {number|string|null} editingId  编辑中的用户 id(新建传 null)
 * @returns {{ok:true, body:object} | {ok:false, reason:string}}
 */
export function buildUserSaveBody(form, editingId = null) {
  const userName = String(form?.userName ?? '').trim()
  if (!userName) return { ok: false, reason: 'needUserName' }

  const editing = editingId !== null && editingId !== undefined && String(editingId).trim() !== ''
  // 新建必须设口令;编辑只有勾了「重置密码」才发 —— 不勾就一个字节都不动
  const wantPassword = editing ? !!form?.resetPassword : true
  const password = String(form?.password ?? '')
  if (wantPassword) {
    if (!password) return { ok: false, reason: 'needPassword' }
    if (password.length < PWD_MIN) return { ok: false, reason: 'tooShort' }
  }

  const body = {
    userName,
    realName: form?.realName ?? '',
    deptId: form?.deptId ?? null,
    roleId: form?.roleId ?? null,
    workshop: form?.workshop ?? '',
    enabled: toSwitchEnabled(form?.enabled),
    // 不重置时**显式发空串**:后端 SysAdminService:148 以 isBlank() 判定「保持原口令」;
    // 也顺手把界面里可能残留的值清掉,免得"只是改个姓名"把口令一起改了
    password: wantPassword ? password : '',
  }
  if (editing) body.id = editingId
  return { ok: true, body }
}
