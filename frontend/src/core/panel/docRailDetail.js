/**
 * docRailDetail.js — 左栏「单据选择」的**明细派生列**(唯一真源,2026-11-20)。
 *
 * 为什么需要它:左栏的行 = 列表行(后端只下发**头表字段** + `detail.items`),
 * 而有些能一眼定位单据的信息**只在明细行上** —— 典型是来料检验单的 物料编码/物料名称
 * (`qc_insp` 头表根本没有这两列,往里写裸字符串列永远取不到值)。
 *
 * 用户口径(2026-11-20):「来料检验单手侧的栏目进行修改,供应商无需显示,显示物料编码物料名称。」
 *
 * 口径细节:
 *   · 一张单检多个物料时并排显示(去重,保持明细行序);
 *   · 分隔符用 ' / '(不写中文连接词,免得这格在英文/日语界面里夹中文);
 *   · 明细为空 / 键为空 ⇒ 空串(左栏照常留空,不显示 '-' 之类的占位)。
 *
 * 本文件是纯函数(无 Vue、无请求),供 PanelxList 与 node:test 共用。
 */

/**
 * 造一个左栏列对象:值由 {@link detailRailText} 从明细行派生。
 * @param {string} label 明细行里的数据键(= yj_field.label)
 * @returns {{label:string, align:string, derive:(row:object)=>string}}
 */
export function detailRailColumn(label) {
  return { label, align: 'left', derive: (row) => detailRailText(row, label) }
}

/**
 * 取明细该键的去重值并拼成一格。
 * @param {object|null|undefined} row 列表行(契约:detail.items = 明细行数组,键为中文 label)
 * @param {string} key 明细行数据键
 * @returns {string}
 */
export function detailRailText(row, key) {
  const items = row?.detail?.items
  if (!Array.isArray(items) || !items.length || !key) return ''
  const seen = new Set()
  const vals = []
  for (const it of items) {
    const v = String(it?.[key] ?? '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    vals.push(v)
  }
  return vals.join(' / ')
}
