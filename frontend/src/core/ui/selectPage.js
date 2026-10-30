/**
 * selectPage.js —— 下拉候选的**翻页**（2026-10-30）
 *
 * 【用户口径·原话】
 *   「如果一个种类的物料超过了一页下拉的长度，可以提供切页选项，通过切页来选择，
 *     就不会出现明明有这个物料但是因为下拉框限制找不到」
 *
 * 【为什么不再用"封顶"】
 *   上一版是「命中超过 N 条就只给前 N 条」，于是第 N+1 条之后的物料**在界面上根本不存在** ——
 *   用户看到的不是"没有了"，而是"这个料没有录"（最坏的一种错：以为档案缺数据，就去重建一条）。
 *   翻页把"截断"换成"还有几页"，代价一样：同一时刻只渲染一页，档案几千行也不会一次渲成几千个 option。
 *
 * 纯函数：只做切片与页码夹取，不碰 DOM、不碰 i18n。
 */

/** 一页放多少条：够在弹层里滑两屏，又不至于把弹层撑得比屏幕还高 */
export const SELECT_PAGE_SIZE = 50

/**
 * 把候选列表切成某一页。
 *
 * @param {Array<any>|null} list 候选全量（已过滤、已排序）
 * @param {number} page 目标页码（1 起；越界会被夹到 [1, pages]，不抛错）
 * @param {number} [size=SELECT_PAGE_SIZE] 每页条数（非法值落回默认）
 * @returns {{items: Array<any>, page: number, pages: number, total: number, from: number, to: number}}
 *   items = 这一页的候选；pages 至少为 1（空列表也算一页，界面上就是"0 条"）；
 *   from/to 是**人看的**序号区间（1 起，含两端），空列表时都是 0
 */
export function slicePage(list, page, size = SELECT_PAGE_SIZE) {
  const arr = Array.isArray(list) ? list : []
  const total = arr.length
  const per = Number.isInteger(size) && size > 0 ? size : SELECT_PAGE_SIZE
  const pages = Math.max(1, Math.ceil(total / per))
  const want = Math.trunc(Number(page) || 1)
  const p = Math.min(Math.max(1, want), pages)
  const start = (p - 1) * per
  const items = arr.slice(start, start + per)
  return { items, page: p, pages, total, from: total ? start + 1 : 0, to: start + items.length }
}
