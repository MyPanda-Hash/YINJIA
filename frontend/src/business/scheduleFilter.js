/**
 * scheduleFilter.js — 快速排产 ②「已排产」列表的**本地筛选**纯逻辑(2026-10-28)
 *
 * 用户口径:「今日已排产完成除去「全部」这个筛选外,还需要增加其他筛选实现 ——
 *   增加模糊搜索查看当前的已排产内容」。
 *
 * 为什么纯前端:② 的数据整表已在手(今日几十行 / 全部四百余行),筛选是「看着这张表找行」,
 * 不做服务端往返 —— 输入即时出结果,也不会因为翻页/重查丢失视图。
 * (服务端 /today 仍保留 keyword 参数:内嵌模式=生产工单页弹出本组件时靠它收敛到一张工单。)
 */

/** 参与模糊搜索的列 —— 与 ② 表格显示的列同名(数据键中文,永不翻译) */
export const SCHEDULED_SEARCH_FIELDS = [
  '加工单号', '工单行号', '批次号', '产品编号', '品名', '型号', '生产线', '排产班组', '计划线',
]

/** 把单元格取值转成可搜文本(数字/空值都安全) */
const cell = (v) => String(v ?? '')

/**
 * 已排产列表筛选。
 *
 * 关键字规则(与「工单排产看板/生产工单列表」的搜索习惯一致,越简单越好):
 *   · 空格分词,**每个词都要命中**任一列(不分大小写)⇒「阻垢 0218」= 品名含阻垢且单号含 0218;
 *   · 不分词时就是普通的子串模糊匹配 ⇒「0218」命中 GD-2026-10-0218;
 *   · 数字词天然也能命中 工单行号/批次号(整串拼进去搜,不另立规则)。
 *
 * @param {Array<object>} rows ② 的原始行(/px/scheduleBoard/today 的返回)
 * @param {{keyword?: string, line?: string, status?: string}} [f]
 *        keyword=模糊词;line=生产线(精确);status=生产状态(精确);空串/undefined = 不筛
 * @returns {Array<object>} 过滤后的行(原引用,不复制)
 */
export function filterScheduled(rows, f = {}) {
  const list = Array.isArray(rows) ? rows : []
  const toks = cell(f.keyword).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const line = cell(f.line).trim()
  const status = cell(f.status).trim()
  if (!toks.length && !line && !status) return list
  return list.filter((r) => {
    if (r == null || typeof r !== 'object') return false
    if (line && cell(r['生产线']).trim() !== line) return false
    if (status && cell(r['生产状态']).trim() !== status) return false
    if (!toks.length) return true
    const hay = SCHEDULED_SEARCH_FIELDS.map((k) => cell(r[k])).join('\u0001').toLowerCase()
    return toks.every((t) => hay.includes(t))
  })
}

/** 当前是否处于"筛选态"(决定要不要显示「清空筛选」) */
export function isFiltering(f = {}) {
  return !!(cell(f.keyword).trim() || cell(f.line).trim() || cell(f.status).trim())
}
