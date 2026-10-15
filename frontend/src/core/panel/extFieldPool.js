/**
 * extFieldPool.js —— 「字段管理」的**备用列池可用性**判定(纯函数,可 node --test)
 *
 * 【为什么要有这条】2026-10-16 审计研发管理 26 张面板:凡**承载表没有预置 备用1..20 列**的面板,
 * `GET /api/px/extFields` 直接 500(后端对 备用N 逐个 `SELECT COUNT(*)`,第 1 个不存在的列就把查询打炸),
 * 用户看到的是「Request failed with status code 500」+ 对话框自动关闭 —— 完全不知道发生了什么。
 * 后端修成「表里没有备用列 ⇒ 下发空池 + poolAvailable:false」后,**前端必须把这件事说清楚**,
 * 所以判定逻辑单独抽出来钉住:池空 = 不能新增自定义字段,而不是"该表有 0 个空位"。
 */

/**
 * @param {object|null} data   extFields 下发体:{ capacity, fields, linePool?, headPool?, tabPools?, poolAvailable? }
 * @param {boolean} needTab    分页签面板(来料检验要求系列):池按页签给账,只要 tabPools 有段就算可用
 * @returns {boolean} true = 这张表没有可用的备用列池(界面必须提示,而不是让用户点"添加"再吃报错)
 */
export function poolUnavailableOf(data, needTab) {
  if (!data) return true
  // 后端新契约优先:显式说"没有池"就信它(空池与"池里没空位"是两回事)
  if (data.poolAvailable === false) return true
  if (needTab) {
    const tp = data.tabPools
    if (!tp || typeof tp !== 'object') return true
    return Object.keys(tp).length === 0
  }
  const line = Array.isArray(data.linePool) ? data.linePool : []
  const head = Array.isArray(data.headPool) ? data.headPool : []
  // 两个池都为空 = 表上没有任何 备用N 列(不是"都被占满";占满时池数组长度仍是 20)
  return line.length === 0 && head.length === 0
}
