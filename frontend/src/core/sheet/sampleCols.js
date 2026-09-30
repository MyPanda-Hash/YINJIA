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
