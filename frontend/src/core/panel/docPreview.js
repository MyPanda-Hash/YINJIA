/**
 * docPreview.js —— 文书侧栏「单据预览查找」卡片的摘要字段口径（纯函数，无 Vue/无 IO）  2026-11-11
 *
 * 【用户口径（逐字）】
 *   「立项申请的单据预览做成和销售订单左侧栏类似，显示最主要的信息方便去查找对应单据」
 *   —— 参照物是「销售订单选择」左侧那张表：一行一张单，只看 单号 / 日期 / 客户 / 审核状态。
 *
 * 【为什么原来的卡片不好用】
 *   旧口径 = "表头前 4 个非空业务字段"，每格 `标签：值` 各占一行。
 *   立项申请那 4 格是 客户名 / 立项背景 / 机型及应用位置 / 滤芯炭棒规格或结构——
 *   后三个是长文本（截到 42 字还会折行）⇒ 一张卡片能占十行，十几张单就要滚好几屏，
 *   想找"某某客户那张"反而更难。参照物里一行只有**一个短摘要**，扫一眼就定位。
 *
 * 【现在的口径（两档，面板自己选）】
 *   · 指定了摘要字段的面板（见 PREVIEW_FIELDS）⇒ **只显示这几个**、不带标签、
 *     与日期同排成一行（`2026-11-10 · 零售客户`），卡片 = 两行；
 *   · 没指定的面板 ⇒ 沿用旧口径（前 4 个非空业务字段、带标签），行为与改前逐字一致。
 *   为什么不一刀切：别的面板（规格书/产品信息/检验计划）摘要格本来就短，
 *   一行一单反而看不出差异；只有长文本面板需要压。
 */

/** 摘要字段剔除清单：系统列与阶段明细列不进卡片 */
export const PREVIEW_SKIP = new Set([
  '单据编号', '编号', '单据日期', '单据状态', '文档编号', '文件管理人', '密级',
  '文件使用范围', '备注', '打印时间', '公司名称',
])

/**
 * 面板 → 摘要字段（按此顺序显示，不带标签）。没登记的面板走通用口径。
 * @type {Record<string, string[]>}
 */
export const PREVIEW_FIELDS = {
  // 立项申请：客户是"找单"的第一线索（参照销售订单左侧的"客户"列）；
  // 项目等级是分档用的短字段；申请立项人用来认"这张单是谁提的"（2026-11-11 用户追加
  // 「还要有申请立项人」）。其余（立项背景/机型/滤芯规格/开发目标…）都是长文本，
  // 扫列表时只会干扰。
  RD_APPROVAL: ['客户名', '项目等级', '申请立项人'],
}

/** 摘要值截断长度（通用口径 42 字；指定字段的比较短，一行能放下） */
export const PREVIEW_VALUE_CAP = 42
export const PREVIEW_COMPACT_CAP = 18

/**
 * 一张卡片的摘要内容。
 *
 * @param {object} p
 * @param {Record<string, any>|null} p.row 单据行（表头键值）
 * @param {Array<{dataName?: string, code?: string}>} p.fields 表头字段定义（顺序即显示顺序）
 * @param {(f: any) => string} p.keyOf 字段定义 → 数据键
 * @param {string} p.panelCode 面板码
 * @param {number} [p.limit] 通用口径最多几个字段（默认 4，与改前一致）
 * @returns {{ compact: boolean, items: Array<{label: string, value: string}> }}
 *   compact=true 表示"指定了摘要字段"：items 不带标签，调用方按一行拼起来；
 *   compact=false 是旧口径：items 带标签、逐行显示。
 */
export function previewSummaryOf({ row, fields, keyOf, panelCode, limit = 4 }) {
  const r = row || {}
  const list = Array.isArray(fields) ? fields : []
  const key = (f) => (typeof keyOf === 'function' ? String(keyOf(f) || '') : String(f?.dataName || f?.code || ''))
  const textOf = (k) => {
    const v = r[k]
    if (v === null || v === undefined) return ''
    return String(v).replace(/\s+/g, ' ').trim()
  }

  const wanted = PREVIEW_FIELDS[panelCode]
  if (Array.isArray(wanted) && wanted.length) {
    const items = []
    for (const k of wanted) {
      const s = textOf(k)
      if (!s) continue
      items.push({ label: k, value: s.length > PREVIEW_COMPACT_CAP ? s.slice(0, PREVIEW_COMPACT_CAP) + '…' : s })
    }
    return { compact: true, items }
  }

  const out = []
  for (const f of list) {
    if (out.length >= limit) break
    const k = key(f)
    if (!k || PREVIEW_SKIP.has(k) || /^阶段\d+/.test(k)) continue
    const s = textOf(k)
    if (!s) continue
    out.push({ label: k, value: s.length > PREVIEW_VALUE_CAP ? s.slice(0, PREVIEW_VALUE_CAP) + '…' : s })
  }
  return { compact: false, items: out }
}

/**
 * 卡片的「一行摘要」文本（仅 compact 面板用）：`零售客户 · 重点`
 * @param {{items: Array<{value: string}>}} summary previewSummaryOf 的返回值
 * @returns {string}
 */
export function previewLineText(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : []
  return items.map((x) => String(x?.value ?? '')).filter(Boolean).join(' · ')
}
