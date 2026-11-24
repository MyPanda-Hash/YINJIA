/**
 * 列表页「按单号定位（?focus=）」的公共口径（2026-11-20）。
 *
 * 【用户报障】「立项查询」（全屏预览浮层）里点某一行 /「跳转」，页面回到**第一张草稿**，
 *   不是目标单据。根因：跳转发生在 closeApprovalPreview() 的 load() **之后**，
 *   且 router.push 到同一 path 只改 query ⇒ 组件不重挂、load 不重跑，?focus= 从未被消费。
 *
 * 这里只放**纯函数**（不引 vue / 路由），让两处消费方共用同一份键序，避免
 *   「load 里按 编号 找、跳转里按 单据编号 找」各写一套又慢慢漂移：
 *   ① 列表行契约的单号键序：编号 → 单据编号 → 锭号
 *      （QueryService.loadDocs 对每张单都 `doc.put("编号", no)`；其余是历史面板兜底键）；
 *   ② 预览浮层是 pageSize=200 一次取全，关闭浮层会还原分页 ⇒ 要用预览里的下标换算目标页码，
 *      否则目标落在第 2 页以后时仍会停在第 1 页（用户看到的仍是"第一张草稿"）。
 *
 * 单测见 docFocus.test.js；消费方接线在 views/PanelxList.vue（consumeFocusQuery / load）。
 */

/** 一行单据的定位键：编号 → 单据编号 → 锭号（空行/非对象返回空串） */
export function docNoOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row['编号'] || row['单据编号'] || row['锭号'] || '').trim()
}

/** 在列表里按单号找下标；单号为空或找不到返回 -1 */
export function findDocIndex(rows, no) {
  const key = String(no ?? '').trim()
  if (!key || !Array.isArray(rows)) return -1
  return rows.findIndex((r) => docNoOf(r) === key)
}

/**
 * `?docNo=单号` 定向取数后的回退判定（2026-11-20）。
 *
 * <p>docNo 是「按单号打开一张单」的深链：列表按单号过滤后再显示那张单，所以不受分页/页签影响。
 * 但目标如果在当前账号的**可见范围外**（别人的单 / 已作废 / 不存在 / 前后端版本不一致），
 * 过滤结果就是 0 行 —— 旧写法停在一个 0/0 的空白列表页，用户看到的仍然不是所点的那张单。
 * 这里只做判定：有单号且确实拿到了空结果集 ⇒ 调用方要清筛选、恢复列表并明确提示。</p>
 *
 * @param {string} no URL 上的 ?docNo=（会去两端空白）
 * @param {Array} rows 定向取数后的列表
 * @returns {boolean} true = 需要回退
 */
export function shouldRestoreAfterDocNo(no, rows) {
  const key = String(no == null ? '' : no).trim()
  if (!key) return false
  return Array.isArray(rows) && rows.length === 0
}

/**
 * 预览列表（pageSize=200 一页取全）里的下标 → 还原分页后目标所在的页码（1 起）。
 *
 * <p>index &lt; 0（预览里没找到目标）/ pageSize 非法时一律回第 1 页 —— 绝不返回 0 页或 NaN，
 * 调用方会直接把它写进 query.pageNo。</p>
 */
export function pageOfPreviewIndex(index, pageSize) {
  const i = Number(index)
  const ps = Math.max(1, Math.floor(Number(pageSize) || 1))
  if (!Number.isFinite(i) || i < 0) return 1
  return Math.floor(i / ps) + 1
}
