/**
 * 文书默认值(Doc Sheet Defaults)
 *
 * 新建/起草文书面板时带出的初始值。真源在这里,不要在组件里再写一份。
 * (2026-09-21 起也承载**采购入库单的批次号预设**:该单不是文书面板,但"填单时预设、用户可改"
 *  的语义与这里的"仅空值带出"完全一致,放同处便于一处维护。)
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
  // 检验数据记录(YJ-QR-96 检验报告):原表「检验人=账号登录人自动生成」——由登录用户锁定填入
  QC_INSP_REC: '检验人',
}

/** 非锁定默认值:'@today' 占位表示当天日期;函数形式按 (form, ctx) 现算 */
const DOC_DEFAULTS = {
  RD_APPROVAL: [['申请立项日期', '@today'], ['文件管理人', '陈秀丽']],
  RD_PLAN: [['文件管理人', '陈秀丽']],
  RD_PROGRESS: [['文件使用范围', '工程技术中心']],
  RD_FILTER_EFF: [['密级', '保密'], ['适用范围', '银嘉内部'], ['测试主题', '伊可普需求2炭棒除VOC测试']],
  // 检验数据记录(YJ-QR-96 检验报告):原表固定项——文件编码 YJ-QR-96 / 检验依据 YJ-Q-30 / 审核人 固定:冯敏
  // (签名行落库列名是「表单审核人」:叫「审核人」会被 ButtonService 保存时显式丢弃,见该面板迁移注释)
  QC_INSP_REC: [['文件编码', 'YJ-QR-96'], ['检验依据', 'YJ-Q-30'], ['表单审核人', '冯敏'], ['检验日期', '@today']],
  // 采购入库单(2026-09-21 二次口径):批次号 = **入库日期**(纯 yyyyMMdd,不带序号),
  // 填单时就预设好、用户可人工改;审核时以表头值为准回填全链(见 BatchService.assignNoAndBackfill)。
  // 旧口径是"审核时才取号、之前留空"—— 那个口径下用户填单时看不到号,已废弃。
  PURCHASE_IN: [['批次号', (form, ctx) => docNoFromDate(form['单据日期'] || ctx.today)]],
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

/**
 * 日期 → 批次号:取前 8 位数字('2026-09-21' / '2026/09/21' / '20260921' → '20260921')。
 * 采购入库单的批次号就是入库日期(「同一日期算同一批次」),所以没有序号、也没有分隔符。
 */
export function docNoFromDate(dateStr) {
  const digits = String(dateStr ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

/**
 * 「单据日期 → 批次号」联动(采购入库单,2026-09-21 口径):
 * 改了「单据日期」时,批次号跟着走 —— 但**只当**批次号为空、或仍是上一次自动带出的值(prevAuto)时;
 * 用户人工改过(≠ prevAuto)则一律不动,人工优先。
 *
 * @param {object} form     表单(键=字段标签,就地改)
 * @param {string} prevAuto 上一次自动带出的批次号(调用方在单据打开/上次联动后存下的)
 * @param {string} today    当天 YYYY-MM-DD(单据日期为空时的兜底)
 * @returns {string} 本次生效的批次号(调用方存为下一次的 prevAuto)
 */
export function syncBatchNoWithDocDate(form, prevAuto = '', today = todayStr()) {
  if (!form || typeof form !== 'object') return ''
  const auto = docNoFromDate(form['单据日期'] || today)
  const cur = String(form['批次号'] ?? '').trim()
  if (!cur || cur === String(prevAuto ?? '').trim()) {
    if (auto) form['批次号'] = auto
    return auto
  }
  return cur
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
    if (!isEmpty(form[key])) continue
    form[key] = typeof value === 'function' ? value(form, { today }) : (value === '@today' ? today : value)
  }
  return form
}
