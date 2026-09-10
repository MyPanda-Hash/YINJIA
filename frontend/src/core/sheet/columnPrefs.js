/**
 * 纸张面板「字段编辑」列偏好(纯函数,无 Vue 依赖)。
 * 用途:表头显示名(别名优先)、列显隐判定、以及"只发改动行"的保存载荷。
 * 口径:别名存在即显示别名,否则回退配置里的默认标签;visible 显式为 false 才算隐藏。
 */

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
 * 保存载荷:只发有改动的行(避免空别名批量覆盖已有别名 + seq 重排副作用)。
 * @param {{key:string, alias:string, originalAlias:string, visible:boolean, originalVisible:boolean}[]} rows
 * @returns {{label:string, alias:string, visible:boolean}[]}
 */
export function buildColumnPrefsPayload(rows = []) {
  return (rows || [])
    .filter((row) => String(row.alias || '') !== String(row.originalAlias || '') || !!row.visible !== !!row.originalVisible)
    .map((row) => ({ label: row.key, alias: row.alias || '', visible: !!row.visible }))
}
