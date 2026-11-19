/**
 * changeCosign.js —— 产品变更申请表（RD_CHANGE）会签 / 管理员终审的**纯判断**
 *
 * 把「谁能填本部门行」「谁能看到最终批准按钮」「按钮叫什么」从 PanelxList 的
 * 一长串 computed/template 条件里抽出来，单测可直接断言；组件只负责把当前
 * 面板码 / 单据状态 / 登录账号 / 部门行喂进来。
 *
 * 口径来源（2026-11-19 用户原话）：
 *   「现在会签人只能点会签通过，但是不能填对应的部门评审意见，
 *     所有会签人会签通过之后，由管理员进行一个最终的审批然后归档」
 *
 * 服务端另有同口径的强制门禁（ButtonService.allowChangeSignoffFill /
 * gateChangeDetail / approveChangeFinal / rejectChangeFinal），前端这里只决定
 * 「显示/可编」，不是唯一防线。
 */

/** 面板码（与 yj_panel.panel_code、recordSheetConfigs 的键一致） */
export const CHANGE_PANEL_CODE = 'RD_CHANGE'
/** 会签进行中（有 PENDING 签名时由后端推导） */
export const CHANGE_SIGNOFF_STATUS = '会签中'
/** 会签全部通过、等待 admin 终审（yj_doc_status: pending='Y' + approve_node=2） */
export const CHANGE_FINAL_STATUS = '待批准'

/** 会签人账号串 → 数组（与后端 ButtonService.signersOf 的切分口径一致） */
export function splitChangeSigners(raw) {
  return String(raw == null ? '' : raw)
    .split(/[,，、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 当前账号是不是本单「会签人」字段里的账号 */
export function isChangeSigner(head, account) {
  const acct = String(account == null ? '' : account).trim()
  if (!acct) return false
  return splitChangeSigners(head && head['会签人']).includes(acct)
}

/**
 * 会签中是否允许该账号编辑「三、部门评审意见」里本部门那一行。
 *
 * 四条同时成立才放行（与服务端 allowChangeSignoffFill 同口径）：
 * ① 面板是 RD_CHANGE；
 * ② 状态是会签中；
 * ③ 当前账号是本单会签人；
 * ④ 账号有匹配的部门行（metadata.changeDepts 非空）。
 *
 * 管理员不在此处豁免：admin 若也是会签人，同样只能填自己部门那一行；
 * 管理员终审走「批准通过」，不靠这个口子。
 */
export function canFillOwnDeptRow({ panelCode, status, head, account, deptRows } = {}) {
  if (String(panelCode || '') !== CHANGE_PANEL_CODE) return false
  if (String(status || '') !== CHANGE_SIGNOFF_STATUS) return false
  if (!isChangeSigner(head, account)) return false
  return Array.isArray(deptRows) && deptRows.length > 0
}

/** 是否到了「待批准」最终节点（只有 RD_CHANGE 有这个词） */
export function isChangeFinalStage(panelCode, status) {
  return String(panelCode || '') === CHANGE_PANEL_CODE && String(status || '') === CHANGE_FINAL_STATUS
}

/** 待批准节点只有 admin 可见/可点最终批准（驳回同权限） */
export function canFinalApprove({ panelCode, status, isAdmin } = {}) {
  return isChangeFinalStage(panelCode, status) && isAdmin === true
}

/** 批准按钮文案：最终节点叫「批准通过」，其余保持「审批通过」 */
export function changeApproveLabel(finalStage) {
  return finalStage ? '批准通过' : '审批通过'
}

/** 驳回按钮文案：最终节点叫「批准驳回」，其余保持「审批驳回」 */
export function changeRejectLabel(finalStage) {
  return finalStage ? '批准驳回' : '审批驳回'
}

/** 轮不到我处理时的侧栏说明（宁可说清在等谁，也别让人对着空侧栏猜） */
export function changeWaitingTip(status) {
  if (String(status || '') === CHANGE_FINAL_STATUS) return '本单会签已全部通过，等待管理员批准'
  return '本单已提交审批，等待审批人处理（提交人不能审批自己提交的单）'
}
