/**
 * 文书默认值(Doc Sheet Defaults)
 *
 * 新建/起草文书面板时带出的初始值。真源在这里,不要在组件里再写一份。
 *
 * 两条口径(2026-09-11 grill 确定):
 *  · **锁定字段**:立项申请的「申请立项人」、实施计划的「负责人」——由当前登录用户决定,
 *    用户不可改(元数据里 editable=0,UI 三处按只读渲染)。只在「新增」时写入;
 *    打开既有单据(isNew=false)一律不碰,否则弃审后再打开会把申请人改成操作人 = 冒名。
 *  · **其余默认值**:仅当为空时填,用户可改(文件管理人/密级/申请立项日期等)。
 *
 * 为什么必须挂在「新增」这一刻:RD_APPROVAL/RD_PLAN 属 DOC_ARCHIVE_PANELS,保存后
 * 管理员=已归档、普通用户=审批中,**都不经过草稿态**;旧实现挂在要求 draftEditable 的
 * watch 上,所以从未执行过。
 */

/** 锁定字段:面板 → 由当前登录用户自动填入的字段标签 */
const LOCKED_PERSON = {
  RD_APPROVAL: '申请立项人',
  RD_PLAN: '负责人',
}

/** 非锁定默认值:'@today' 占位表示当天日期 */
const DOC_DEFAULTS = {
  RD_APPROVAL: [['申请立项日期', '@today'], ['文件管理人', '陈秀丽']],
  RD_PLAN: [['文件管理人', '陈秀丽']],
  RD_PROGRESS: [['文件使用范围', '工程技术中心']],
  RD_FILTER_EFF: [['密级', '保密'], ['适用范围', '银嘉内部'], ['测试主题', '伊可普需求2炭棒除VOC测试']],
}

/** 该面板由当前用户锁定的字段标签;没有则 null */
export function lockedPersonLabel(panelCode) {
  return LOCKED_PERSON[String(panelCode || '')] || null
}

/** 本地时区的 YYYY-MM-DD(用 UTC 直取会在东八区差一天) */
export function todayStr(d = new Date()) {
  const t = d instanceof Date ? d : new Date(d)
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/** 当前用户显示名(user store 的 realName getter 同口径:姓名优先,退回账号) */
function displayNameOf(user) {
  return String((user && (user.realName || user.userName)) || '').trim()
}

/**
 * 就地套用默认值,返回同一个 form(便于链式调用)。
 * @param {string} panelCode 面板编码
 * @param {object} form 表单(键=字段标签)
 * @param {object} user 当前用户(realName/userName)
 * @param {{isNew?: boolean, today?: string}} opts isNew=新增(才写锁定字段)
 */
export function applyDocDefaults(panelCode, form, user, opts = {}) {
  if (!form || typeof form !== 'object') return form
  const code = String(panelCode || '')
  const { isNew = false, today = todayStr() } = opts

  if (isNew) {
    const locked = lockedPersonLabel(code)
    const name = displayNameOf(user)
    if (locked && name) form[locked] = name
  }

  for (const [key, value] of DOC_DEFAULTS[code] || []) {
    if (isEmpty(form[key])) form[key] = value === '@today' ? today : value
  }
  return form
}
