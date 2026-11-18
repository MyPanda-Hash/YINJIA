/**
 * 报表栏目设置纯函数层(报表表头筛选与排序补丁)。
 * 无 Vue 依赖,可被 composable 与单元测试共用。
 */

import { sortRows } from '../sort/rowSort.js'

/**
 * 列的「固定位置」取值(2026-11-18 用户口径:列设置要能把列钉住,不随横向滚动移动)。
 * `''` = 不固定;`'left'` = 固定左侧;`'right'` = 固定右侧。
 * @param {*} pin
 * @returns {''|'left'|'right'}
 */
export function normalizePin(pin) {
  return pin === 'left' || pin === 'right' ? pin : ''
}

/**
 * 取某一列的固定位置(页面默认 + 用户设置)。
 *
 * 口径:设置里**显式存过 `pin`**(含空串 = 用户主动取消固定)就用它;
 * 没存过(老设置/刚新增的列)才回落到页面默认(`defaults[prop]`)。
 * —— 这样"取消默认冻结列的固定"也能生效,不会被默认值又盖回去。
 *
 * @param {{prop:string, pin?:string}|string|null} col 列草稿项或列名
 * @param {Object<string,'left'|'right'>} [defaults] 页面默认固定位置表(如工单排产的冻结区)
 * @returns {''|'left'|'right'}
 */
export function columnPinOf(col, defaults = {}) {
  const prop = col && typeof col === 'object' ? col.prop : col
  if (col && typeof col === 'object' && Object.prototype.hasOwnProperty.call(col, 'pin')) {
    return normalizePin(col.pin)
  }
  return normalizePin(defaults ? defaults[prop] : '')
}

/**
 * 按固定位置把列排成「固定左 → 不固定 → 固定右」三段(2026-11-18)。
 *
 * Element Plus 的 el-table 自己也会把 fixed 列重排到两端(store/watcher:固定左 + 非固定 + 固定右),
 * 这里再排一次是为了:① 同一端内部的顺序 = 列设置里的顺序(与弹窗所见一致);
 * ② 给每列补上 `fixed` 属性,模板直接 `:fixed="col.fixed"`;
 * ③ 纯函数,可单测。
 *
 * @param {Object[]} columns 列定义(可带 pin)
 * @returns {Object[]} 新数组(元素带 fixed:'left'|'right',不固定的不带)
 */
export function groupColumnsByPin(columns = []) {
  const left = []
  const middle = []
  const right = []
  for (const c of columns) {
    if (!c) continue
    const pin = normalizePin(c.pin)
    if (pin === 'left') left.push({ ...c, fixed: 'left' })
    else if (pin === 'right') right.push({ ...c, fixed: 'right' })
    else middle.push({ ...c })
  }
  return [...left, ...middle, ...right]
}

/**
 * 构建栏目设置数组。
 *
 * 顺序口径(2026-10-29 增,列设置支持"调整列顺序"):
 *   · 已保存的 `columns[]` **顺序即用户调好的列顺序** ⇒ 优先按它排列(只保留当前仍存在的列);
 *   · 当前面板里新增、保存里没有的列,按传入 `columns` 的默认顺序追加在后面(不丢列);
 *   · 保存里没有的列默认 visible=true;保存里的 prop 去重(防脏数据把同一列排两次)。
 *   —— 报表面板此前只用 visible/排序(visibleProps 只做 contains 判定),故顺序变化对它们无影响。
 *
 * 固定位置(2026-11-18):保存里**显式存过** `pin` 才原样带进草稿(空串也是一份明确选择 = 不固定);
 *   没存过就不写这个键 ⇒ 由页面默认(`columnPinOf` 的 defaults)决定,老设置自然兼容。
 *
 * @param {string[]} columns - 面板全部字段名列表(默认顺序)
 * @param {Object|null} saved - 后端保存的设置
 * @returns {{prop:string, label:string, visible:boolean, pin?:''|'left'|'right'}[]}
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
    const out = {
      prop,
      label: hit?.label || prop,
      visible: savedByProp.has(prop) ? hit.visible !== false : true
    }
    if (hit && Object.prototype.hasOwnProperty.call(hit, 'pin')) out.pin = normalizePin(hit.pin)
    return out
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
