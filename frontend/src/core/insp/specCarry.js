/**
 * 「自动填充规格书」的失败口径(出货检验计划表 RD_INSP_PLAN ← 规格书 RD_SPEC_DOC)。
 *
 * 用户口径(2026-09-21):
 *   「出货检验计划表检验方法按规格书自动填充/带入,避免重复选择。
 *     必须得规格书已经填写提交审批完才可以在选择产品编码时自动填充带入。」
 * 即:规格书没走完提交审批(草稿/审批中/…)时,**一个格都不许自动带入** ——
 * 拿未定稿的检验方法去填出货检验计划,等于把没批准的检验口径发到产线。
 *
 * 门禁在后端(权威):/api/px/specByProduct 只挑「已审核/已归档」的规格书,
 * 没挑到就返回 found:false + reason:'not_approved' + 是哪一张、什么状态;
 * 本模块只负责把那个 payload 翻成界面要说的人话口径(纯函数,有单测)。
 *
 * @param {{found?: boolean, reason?: string, 规格书编号?: string, 规格书状态?: string}|null} payload 后端返回值
 * @returns {null | {kind: 'not_approved'|'no_spec', specNo: string, status: string}} null = 拿得到规格书
 */
export function specCarryFailure(payload) {
  const p = payload || {}
  if (p.found) return null
  if (p.reason === 'not_approved') {
    return {
      kind: 'not_approved',
      specNo: String(p['规格书编号'] ?? '').trim(),
      status: String(p['规格书状态'] ?? '').trim(),
    }
  }
  return { kind: 'no_spec', specNo: '', status: '' }
}
