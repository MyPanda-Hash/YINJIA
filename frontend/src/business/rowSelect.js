/**
 * rowSelect.js — 表格「点整行即勾选」的公共判据(2026-11-17 用户口径)
 *
 * <p>用户口径:「不需要只选择一定要点那个小方框,而是可以点击这一行来选择」——
 * 订单结转 / 生产工单 / 工单排产 / 快速排产 四张表统一:点行 = 翻转该行勾选,
 * 行首那个复选框降级成「状态显示 + 表头全选 + 键盘可达」。</p>
 *
 * <p>为什么不是"所有点击都翻一次"(2026-11-13 同一坑,ProductImportDialog / RecordSheetPanels /
 * RefPickDialog 各自踩过一次、各自写了一份 closest 判断):</p>
 * <ol>
 *   <li>点复选框本身:那一下 el-checkbox 的 change 已经翻过一次,行点击再翻一次
 *       ⇒ 看起来像"点了没反应";</li>
 *   <li>格内控件:交货日期选择器 / 本次转单数量输入框 / 日排产格子 / 工单号链接 ——
 *       用户点它是想改数或跳转,不是想选行;顺手翻一次勾选会让人莫名其妙
 *       (把已勾的行取消了,后面点「转工单」就少一行)。</li>
 * </ol>
 * <p>所以统一先看 event.target 的祖先链:命中控件就**不动勾选**。各页自己的可点格子
 * (如日排产格 `.dp-plan`)通过 extra 传进来,不往公共表里塞页面私货。</p>
 */

/** 通用控件祖先:命中即不翻勾选。只收"真的会吃掉这次点击"的元素,不收 el-tag 之类的纯展示标签 */
export const ROW_CLICK_SKIP = [
  'a', 'button', 'input', 'textarea', 'select', 'label',
  '.el-checkbox', '.el-checkbox__input', '.el-checkbox__inner',
  '.el-radio', '.el-switch',
  '.el-input', '.el-input-number', '.el-textarea', '.el-select', '.el-date-editor',
  '.el-link', '.el-button',
].join(', ')

/**
 * 这次点击该不该翻转行勾选。
 *
 * @param {EventTarget|null|undefined} target 点击目标(event.target)
 * @param {string} [extra] 页面自己的可点格子选择器(如 `.dp-plan`),与 ROW_CLICK_SKIP 取并集
 * @returns {boolean} true=可以翻勾选;false=这次点击归格内控件
 */
export function isRowToggleClick(target, extra = '') {
  // 拿不到 target(程序化调用/事件不全)按"可以翻"处理:宁可多选一次,也别点了没反应
  if (!target || typeof target.closest !== 'function') return true
  const selector = extra ? `${extra}, ${ROW_CLICK_SKIP}` : ROW_CLICK_SKIP
  return !target.closest(selector)
}

/**
 * 行点击 ⇒ 翻转该行勾选。
 *
 * <p>翻转走 el-table 自己的 `toggleRowSelection`(不另存一份数组):这四张表里
 * 订单结转 / 生产工单 / 快速排产①都开了 `reserve-selection`(跨页保留勾选),
 * 自己维护数组会跟表格内部状态打架 —— 与 ProductImportDialog 同一教训。</p>
 *
 * @param {{toggleRowSelection?:Function, getSelectionRows?:Function}|null} table el-table 实例(ref 解包后的值)
 * @param {object} row 被点的行(必须是表格 data 里的同一个对象引用)
 * @param {Event} event 行点击事件
 * @param {{extra?:string}} [opts] extra=页面自己的可点格子选择器
 * @returns {boolean} 是否真的翻转了(被格内控件拦下 / 表格没就绪 = false)
 */
export function toggleRowOnRowClick(table, row, event, opts = {}) {
  if (!row || !table || typeof table.toggleRowSelection !== 'function') return false
  if (!isRowToggleClick(event && event.target, opts.extra)) return false
  const selected = typeof table.getSelectionRows === 'function' ? (table.getSelectionRows() || []) : []
  table.toggleRowSelection(row, selected.indexOf(row) === -1)
  return true
}
