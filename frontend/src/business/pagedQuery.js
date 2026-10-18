/**
 * pagedQuery.js — 面板列表的「翻页拉全」工具(2026-10-18)
 *
 * 为什么单独一个模块:分页规则是纯逻辑(不需要 HTTP、不需要 @core 别名),
 * 单独抽出来才能被 `node --test` 直接测 —— engine.js 依赖 `@core/request`,
 * 在 node 下 import 就炸,测试跑不起来。
 *
 * 背景(用户报「商品面板里显示没有库存」):
 *   `fillCurrentStock` 原来写死 `{ pageNo: 1, pageSize: 500 }`,只取库存状况表的第一页;
 *   而正式库 `v_stock_balance` 实测 **1366 行** ⇒ 501 行之后的存货匹配不到,
 *   现存量一律回填 0,界面即「没有库存」。
 *   任何「按全量口径匹配/聚合」的列表都要走这里,别再写死单页。
 *
 * 停止条件(按可靠性排序):
 *   ① 后端给了 totalSize 且已收满 ⇒ 停(最准)
 *   ② 后端没给 totalSize ⇒ 某页不满 pageSize 即到头(常规分页约定)
 *   ③ 收满 maxPages 仍没到头 ⇒ 兜底停(防后端 totalSize 异常导致死循环)
 */

/** 默认每页 500(与后端常用上限一致;太大后端会截断) */
export const DEFAULT_PAGE_SIZE = 500
/** 默认最多翻 40 页 = 2 万行,足够覆盖当前最大面板(库存状况表 1366 行) */
export const DEFAULT_MAX_PAGES = 40

/**
 * 翻页把一个面板的列表行拉全。
 *
 * @param {(pageNo: number, pageSize: number) => Promise<{ list?: any[], totalSize?: number }>} fetchPage
 *        取一页的函数;返回 { list, totalSize }(totalSize 缺失按「不满一页即到头」判断)
 * @param {{ pageSize?: number, maxPages?: number }} [opts]
 * @returns {Promise<any[]>} 全部行(按页序拼接)
 */
export async function fetchAllRows(fetchPage, opts = {}) {
  const pageSize = opts.pageSize || DEFAULT_PAGE_SIZE
  const maxPages = opts.maxPages || DEFAULT_MAX_PAGES
  const rows = []

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const res = (await fetchPage(pageNo, pageSize)) || {}
    const list = Array.isArray(res.list) ? res.list : []
    rows.push(...list)

    // ① 后端给了总数:收满即停(避免多请求一次空页)
    const total = Number(res.totalSize)
    if (Number.isFinite(total) && total >= 0 && rows.length >= total) break
    // ② 没给总数或总数不可信:空页 / 不满一页 ⇒ 到头
    if (!Array.isArray(res.list) || list.length < pageSize) break
  }

  return rows
}
