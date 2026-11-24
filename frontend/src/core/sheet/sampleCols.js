/**
 * sampleCols.js — 数据记录表「功能性滤效」(RD_FILTER_EFF)的**动态样品列字段单一真源**。
 *
 * 面板按头字段「样品数」(2~6)把若干行**按样品**铺开:加一个样品列 ⇒ 这些字段各多一格;
 * 减一个样品列 ⇒ 这些字段的该列数据必须清空(用户口径:减列即清数据,确认弹窗后执行)。
 * 字段名 = 前缀 + 序号(`样品信息1` / `样品配方3` …),与 yj_field.label(数据键)同名。
 *
 * 【为什么必须集中管理】2026-09-30 用户报「样品配方列数应该跟样品信息同步」:
 *   样品配方 原是一个**单字段**(纸面一格跨全部样品列),而设计原表里它是**每样品一格**
 *   ——《数据记录表.xlsx》sheet 功能性滤效 第 10 行 merges `C10:G10` + `H10:L10`,
 *   与第 11 行 样品信息 `C11:G11` + `H11:L11` **同一分块**。
 *   病根是「哪些字段按样品铺开」散在组件里:漏登记一个前缀 ⇒ 加列时不分裂、减列时不清空,
 *   而且要等用户减列才暴露。这里集中成常量 + 纯函数,由 sampleCols.test.js 钉死。
 */

/** 按样品铺开的**头字段**前缀(每样品一格;字段名 = 前缀 + 1..样品数) */
export const SAMPLE_HEAD_PREFIXES = ['样品信息', '测试装置及编号', '样品配方']

/** 按样品铺开的**明细行**字段前缀(3.数据记录表里每组各样品一列) */
export const SAMPLE_DETAIL_PREFIXES = [
  '压力（PSI)样品',
  '流速（L/min)样品',
  '出水含量（ug/L）样品',
  '去除率%样品',
]

/**
 * 「3.数据记录表」里由**样品数**驱动的三组动态列(顺序 = 纸面顺序)。
 * 压力组的「流速」与压力共用同一格(combo),不单独成列 —— 与 DataRecordSheet 的 DT_GROUPS 同源。
 * 分组标题文案留在组件里走 i18n;这里只钉「组名 → 字段前缀」。
 */
export const SAMPLE_SHEET_GROUPS = [
  { name: '压力', prefix: '压力（PSI)样品', label: '取样前样品：压力（PSI)/流速（L/min）' },
  { name: '出水', prefix: '出水含量（ug/L）样品', label: '出水含量（ug/L）' },
  { name: '去除率', prefix: '去除率%样品', label: '去除率%' },
]

/**
 * 该字段名是否属于「由样品数驱动的动态样品列」(明细组前缀 + 正整数序号)。
 *
 * <p>这类列**必须随「样品数」同步增删,不允许被列偏好隐藏**。2026-11-20 生产事故:
 * 该面板 {@code yj_field} 里 `出水含量（ug/L）样品2..6` / `去除率%样品2..6` 被历史
 * 「表格调整」置成 hidden=1/visible=0(见 tools/migrate-filter-eff-dyncols-visible-20261120.sql),
 * 而表头/表体都是 `v-if="!dtHidden(key)"` ⇒ 点右上角 ＋ 时只有「取样前样品」跟着加列,
 * 另两组永远只剩样品1(本地库这些行是 visible=1,所以本地复现不了)。</p>
 */
export function isDynamicSampleKey(key) {
  const k = String(key ?? '')
  const prefix = SAMPLE_DETAIL_PREFIXES.find((p) => k.startsWith(p))
  if (!prefix) return false
  return /^[1-9]\d*$/.test(k.slice(prefix.length))
}

/**
 * 某样品组 1..count 的字段名(非法 count 安静返回 [],不抛错)。
 * 列数恒等于 count —— 表头 colspan / colgroup / 表体三处都从这里取,防止各算各的。
 */
export function sampleDetailKeys(prefix, count) {
  const n = Number(count)
  if (!prefix || !Number.isFinite(n) || n < 1) return []
  return Array.from({ length: Math.floor(n) }, (_, i) => `${prefix}${i + 1}`)
}

/** 第 n 个样品的字段名(与 yj_field.label 同名) */
export function sampleHeadKey(prefix, n) {
  return `${prefix}${n}`
}

/**
 * 清空第 n 个样品列的全部数据(头字段 + 每一行明细),返回被清空的键清单。
 * 其它样品列一格不动;head/明细缺失或序号非法时安静返回(减列是常态操作,不该抛错)。
 * @param {object} head 单据表头(含 detail.items)
 * @param {number} n 被减掉的样品序号(1..6)
 * @returns {string[]} 本次清空的键(重复的明细键只记一次)
 */
export function clearSampleColumn(head, n) {
  const idx = Number(n)
  if (!head || !Number.isFinite(idx) || idx < 1) return []
  const cleared = []
  for (const prefix of SAMPLE_HEAD_PREFIXES) {
    const k = sampleHeadKey(prefix, idx)
    head[k] = ''
    cleared.push(k)
  }
  for (const row of head?.detail?.items || []) {
    if (!row) continue
    for (const prefix of SAMPLE_DETAIL_PREFIXES) {
      const k = sampleHeadKey(prefix, idx)
      row[k] = ''
      cleared.push(k)
    }
  }
  return cleared
}
