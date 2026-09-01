/**
 * 报表栏目设置纯函数层(报表表头筛选与排序补丁)。
 * 无 Vue 依赖,可被 composable 与单元测试共用。
 */

/**
 * 构建栏目设置数组。
 * @param {string[]} columns - 面板全部字段名列表
 * @param {Object|null} saved - 后端保存的设置
 * @returns {{prop:string, label:string, visible:boolean}[]}
 */
export function buildReportColumnSettings(columns = [], saved = null) {
  const savedByProp = new Map((saved?.columns || []).map((column) => [column.prop, column]))
  return columns.map((prop) => ({
    prop,
    label: savedByProp.get(prop)?.label || prop,
    visible: savedByProp.has(prop) ? savedByProp.get(prop).visible : true
  }))
}

/**
 * 过滤出可见列。
 * @param {{prop:string, visible:boolean}[]} settings
 * @returns {string[]}
 */
export function visibleReportColumns(settings = []) {
  return settings.filter((column) => column.visible).map((column) => column.prop)
}

/**
 * 排序数据行。数字列按数值排序,其他按中文 localeCompare 排序。
 * @param {Object[]} rows - 原始数据行
 * @param {{prop:string, order:string}} sort - 排序配置
 * @returns {Object[]}
 */
export function sortReportRows(rows = [], sort = {}) {
  if (!sort.prop || !sort.order) return [...rows]
  return [...rows].sort((left, right) => {
    const a = left[sort.prop] ?? ''
    const b = right[sort.prop] ?? ''
    const numberA = Number(a)
    const numberB = Number(b)
    const numeric = a !== '' && b !== '' && Number.isFinite(numberA) && Number.isFinite(numberB)
    const result = numeric
      ? numberA - numberB
      : String(a).localeCompare(String(b), 'zh-CN')
    return sort.order === 'asc' ? result : -result
  })
}
