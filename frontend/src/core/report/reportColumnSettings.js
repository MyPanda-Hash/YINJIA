/**
 * 报表栏目设置纯函数层(报表表头筛选与排序补丁)。
 * 无 Vue 依赖,可被 composable 与单元测试共用。
 */

import { sortRows } from '../sort/rowSort.js'

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
