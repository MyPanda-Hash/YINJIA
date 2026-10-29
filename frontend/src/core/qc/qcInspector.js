/**
 * 工序检验三单(首件 / 制程 / 组装成品)的「检验人员」默认值。
 *
 * 用户口径(2026-10-21):「将当前首件检验单,制程检验单,组装成品检验单的检验人员都填写
 * 默认当前电脑端的用户而不是 system(手机端报工吸收)」。
 *
 * 背景:这三张单会由**手机端报工吸收**(`ExternalReportAbsorbService` 定时任务)在后台自动出单,
 * 那条路没有登录人 —— 原来把审计用的 `system(手机端报工吸收)` 当成了检验员写进单头。
 * 检验员是**纸面上签字的人**,只能来自"此刻在电脑前操作的人",所以:
 *   ① 后台出单**不写**检验员(审计留痕仍写 asp_user2/create_by,不丢追溯);
 *   ② 电脑端打开可编辑草稿时,本模块把空值/历史 system 占位换成**当前登录人姓名**;
 *   ③ 后端保存时同一口径再兜底一次(`ButtonService.defaultQcInspector`)。
 *
 * ⚠ 只在可编辑草稿上带出:已审核/已归档的签名格是事实,一律不改。
 * ⚠ 真源一份:面板名单、占位值判定、显示名口径都在这里;PanelxList 只负责调用。
 */

/** 三张工序检验单的面板编码(改范围只改这一处) */
export const QC_INSPECTOR_PANELS = ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP']

/** 后台任务写进检验员的占位值前缀(`system` / `system(手机端报工吸收)`);大小写不敏感 */
const SYSTEM_MARKER_PREFIX = 'system'

/** 是否后台占位值(不是真人姓名) */
export function isSystemInspector(value) {
  return String(value ?? '').trim().toLowerCase().startsWith(SYSTEM_MARKER_PREFIX)
}

/**
 * 当前单据需不需要带出默认检验人员。
 * @param {string} panelCode 面板编码
 * @param {object} head 单据头(键=字段标签)
 */
export function needsInspectorDefault(panelCode, head) {
  if (!QC_INSPECTOR_PANELS.includes(String(panelCode ?? ''))) return false
  if (!head || typeof head !== 'object') return false
  const cur = String(head['检验员'] ?? '').trim()
  return cur === '' || isSystemInspector(cur)
}

/** 当前电脑端登录人的显示名(姓名优先,退回账号;与 core/panel/docDefaults.displayNameOf 同口径) */
export function pcUserName(user) {
  return String((user && (user.realName || user.userName)) || '').trim()
}

/**
 * 就地补默认值,返回同一个 head(便于链式调用)。
 * 没有登录人 / 不需要补时原样返回,绝不清空已有值。
 * @param {string} panelCode 面板编码
 * @param {object} head 单据头(键=字段标签)
 * @param {object} user 当前登录用户(realName/userName)
 */
export function applyInspectorDefault(panelCode, head, user) {
  if (!needsInspectorDefault(panelCode, head)) return head
  const name = pcUserName(user)
  if (name) head['检验员'] = name
  return head
}
