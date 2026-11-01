/**
 * 报表栏目设置纯函数层(报表表头筛选与排序补丁)。
 * 无 Vue 依赖,可被 composable 与单元测试共用。
 */

import { sortRows } from '../sort/rowSort.js'

/**
 * 构建栏目设置数组。
 *
 * 顺序口径(2026-10-29 增,列设置支持"调整列顺序"):
 *   · 已保存的 `columns[]` **顺序即用户调好的列顺序** ⇒ 优先按它排列(只保留当前仍存在的列);
 *   · 当前面板里新增、保存里没有的列,按传入 `columns` 的默认顺序追加在后面(不丢列);
 *   · 保存里没有的列默认 visible=true;保存里的 prop 去重(防脏数据把同一列排两次)。
 *   —— 报表面板此前只用 visible/排序(visibleProps 只做 contains 判定),故顺序变化对它们无影响。
 *
 * @param {string[]} columns - 面板全部字段名列表(默认顺序)
 * @param {Object|null} saved - 后端保存的设置
 * @returns {{prop:string, label:string, visible:boolean}[]}
 */
export function buildReportColumnSettings(columns = [], saved = null) {
  const savedCols = Array.isArray(saved?.columns) ? saved.columns.filter((c) => c && c.prop) : []
  const savedByProp = new Map()
  for (const c of savedCols) if (!savedByProp.has(c.prop)) savedByProp.set(c.prop, c)
  const known = new Set(columns)
  const ordered = []
  for (const c of savedCols) if (known.has(c.prop) && !ordered.includes(c.prop)) ordered.push(c.prop)
  for (const prop of columns) if (!ordered.includes(prop)) ordered.push(prop)
  return ordered.map((prop) => {
    const hit = savedByProp.get(prop)
    return {
      prop,
      label: hit?.label || prop,
      visible: savedByProp.has(prop) ? hit.visible !== false : true
    }
  })
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
 * 排序数据行。2026-09-09 起与表格面板共用同一套类型化比较器
 * (core/sort/rowSort:字段类型优先 → 数值/时间/拼音,空值恒最后)。
 * 未传字段元数据时沿用旧口径(两侧都能当数字才按数字),历史调用与单测语义不变。
 * @param {Object[]} rows - 原始数据行
 * @param {{prop:string, order:string, field?:Object}} sort - 排序配置
 * @returns {Object[]}
 */
export function sortReportRows(rows = [], sort = {}) {
  return sortRows(rows, sort)
}
