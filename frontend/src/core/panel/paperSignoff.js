/**
 * 纸面「审批人」格的显示门禁（2026-11-20 用户口径）。
 *
 * 【用户原话】
 *   「审批人没有默认显示名字，在审批之后才填进去」
 *   —— 截图里的「审核人（一级审核）」在**草稿/未审批**单据上仍显示「陈秀丽」。
 *
 * 【门禁与落库是两件事】
 *   · 落库真源：新建不写默认值（docDefaults 已空、yj_panel.config.headDefaults 由迁移清掉），
 *     一级/二级审批通过时由 ButtonService 的审批动作写入真实审批人姓名；
 *   · 本模块只管**纸面显示**：老单据/旧页面里即使还带着历史值，未到允许的状态就不显示，
 *     避免「没审批也签名了」的观感。保存时后端还会把这两格从入参剥离，不回写历史值。
 *
 * 【配置形状】（面板级，键 = 数据键 yj_field.label，值 = 允许显示的单据状态白名单）
 *   signoffVisibility: {
 *     '审核人（一级审批人）': ['待二级审批', '已审核', '已归档', '修改中'],
 *     '审核人（二级审批人）': ['已审核', '已归档', '修改中'],
 *   }
 *   · 未声明该键的面板：一律显示（其它面板行为逐字不变）；
 *   · 状态不在白名单（含空状态/未知状态）：不显示。
 */

/** 该格此刻是否有权显示：未声明门禁 = true；声明了则必须命中状态白名单 */
export function signoffVisible(cfg, key, docStatus) {
  const gate = cfg && cfg.signoffVisibility
  if (!gate || !Object.prototype.hasOwnProperty.call(gate, key)) return true
  const allow = gate[key]
  if (!Array.isArray(allow)) return true
  return allow.includes(String(docStatus == null ? '' : docStatus))
}

/** 纸面单元格最终文本：门禁不放行时返回空串（渲染层回落占位/空白，绝不给历史值） */
export function signoffPaperText(cfg, key, value, docStatus) {
  if (!signoffVisible(cfg, key, docStatus)) return ''
  return value == null ? '' : String(value)
}
