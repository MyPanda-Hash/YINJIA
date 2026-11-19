/**
 * 纸张面板「字段编辑」列偏好(纯函数,无 Vue 依赖)。
 * 用途:表头显示名(别名优先)、列显隐判定、以及"只发改动行"的保存载荷。
 * 口径:别名存在即显示别名,否则回退配置里的默认标签;visible 显式为 false 才算隐藏
 * —— 但「由样品数驱动的动态样品列」例外:它们恒显示,见 isColumnHiddenFor。
 */
import { isDynamicSampleKey } from './sampleCols.js'

/** 列显示名:别名(displayName)优先,缺省用默认标签 */
export function resolveColumnLabel(field, fallback) {
  const alias = field && field.displayName ? String(field.displayName) : ''
  return alias || fallback || ''
}

/** 列是否隐藏:只有后端明确给出 visible=false 才隐藏 */
export function isColumnHidden(field) {
  return !!field && field.visible === false
}

/**
 * 渲染用显隐判定(带动态样品列护栏):动态样品列**恒显示**,不受任何列偏好影响。
 *
 * <p>2026-11-20 生产事故(用户连报两次):`RD_FILTER_EFF` 的 `yj_field` 里
 * `出水含量（ug/L）样品2..6` / `去除率%样品2..6` 残留 hidden=1/visible=0(历史「表格调整」),
 * 而「3.数据记录表」三组都按 `v-if="!dtHidden(key)"` 渲染 ⇒ 点右上角样品列 ＋/－ 时
 * 只有「取样前样品」跟着增删,`出水含量（ug/L）`、`去除率%` 两组永远只剩样品1。
 * 本地库这些行是 visible=1,所以本地复现不了 —— 病根是**数据脏 + 渲染层没有护栏**。</p>
 *
 * @param {string} key 字段键(与 yj_field.label 同名)
 * @param {object|null} field 元数据字段规格(含 visible)
 */
export function isColumnHiddenFor(key, field) {
  if (isDynamicSampleKey(key)) return false
  return isColumnHidden(field)
}

/**
 * 保存载荷:只发有改动的行(避免空别名批量覆盖已有别名 + seq 重排副作用)。
 * @param {{key:string, alias:string, originalAlias:string, visible:boolean, originalVisible:boolean}[]} rows
 * @returns {{label:string, alias:string, visible:boolean}[]}
 */
export function buildColumnPrefsPayload(rows = []) {
  return (rows || [])
    .filter((row) => String(row.alias || '') !== String(row.originalAlias || '') || !!row.visible !== !!row.originalVisible)
    .map((row) => ({ label: row.key, alias: row.alias || '', visible: !!row.visible }))
}
