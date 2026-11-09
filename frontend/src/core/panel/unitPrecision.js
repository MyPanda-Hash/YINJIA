/**
 * unitPrecision.js — 计量单位 → 数量精度(2026-11-09 用户口径:
 * 「对其余单据 wms 管理的单据和库存,智能供应链的单据也要用这个计量单位来对症」)。
 *
 * 与后端 `UnitPrecision` / `BatchService.unitDecimals` **同一口径**:
 *   · 精度来源:面板配置下发的 `unitDecimals`(后端读 bs_uom.小数位数:个/卷/张=0、kg/米=3);
 *     表里没有该单位 → 2 位兜底;
 *   · 取整方向:**向下**(计件 4.6 → 4;与超送一致,用户 2026-11-09 选定);
 *   · 只处理字段名含「数量」且行上有单位的列,金额/单价/税率不动。
 *
 * 放 core 层是因为面板引擎(列表/表单)都要用,而架构闸门禁止 core import business。
 * 单测见同目录 unitPrecision.test.js。
 */

/** 单位值 → 小数位数(单位没值 → null:表示"不按单位格式化") */
export function unitDecimalsOf(unitMap, unit) {
  const k = String(unit ?? '').trim().toLowerCase()
  if (!k) return null
  const hit = unitMap ? unitMap[k] : undefined
  if (hit === undefined || hit === null || String(hit) === '') return 2
  const n = Number(hit)
  return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.trunc(n))) : 2
}

/** 行上的单位值:双单位(数量2/计量单位2)按第 2 单位;否则第 1 单位(含库存报表的「主单位」) */
export function unitOfRow(row, suffix = '') {
  if (!row) return ''
  const v = row['计量单位' + suffix] ?? row['单位' + suffix]
    ?? row['计量单位'] ?? row['单位'] ?? row['计量单位名称'] ?? row['主单位'] ?? row['主计量单位']
  return v == null ? '' : String(v).trim()
}

/** 数量类字段判定(2026-11-09):库存报表的数量列叫「期初结存/本期入库/期末结存」,不带"数量"二字 */
const QTY_LABEL_RX = /(数量|结存|期初|期末|入库|出库)/
/** 反例:单号/金额/日期/单位…不是数量 */
const NOT_QTY_RX = /(单号|编号|金额|单价|税额|日期|时间|次数|状态|类型|方式|人|单位|仓库)/

/** 字段标签是否"数量类"(金额/单价/单位列一律不是) */
export function isQtyLabel(label) {
  const name = String(label ?? '')
  if (!name || NOT_QTY_RX.test(name)) return false
  return QTY_LABEL_RX.test(name)
}

/**
 * 数量类字段的小数位数:字段是数量类且行上有单位 → 单位精度;否则 null(普通字段)。
 *
 * @param {string} label 字段中文标签(数量/实收数量/期初结存/期末结存…)
 * @param {object} row   明细行(要能取到单位)
 * @param {object} unitMap 面板配置下发的 unitDecimals(单位小写 → 位数)
 */
export function qtyDecimalsOf(label, row, unitMap) {
  if (!isQtyLabel(label) || !row) return null
  const name = String(label ?? '')
  const suffix = (name.match(/(\d+)$/) || [, ''])[1]
  return unitDecimalsOf(unitMap, unitOfRow(row, suffix))
}

/** 按精度向下取整(与后端 UnitPrecision.floorTo 同一实现;1e-9 容差吃掉浮点尾差) */
export function floorTo(v, decimals) {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  const nd = Math.max(0, Math.min(4, Math.trunc(Number(decimals) || 0)))
  const p = Math.pow(10, nd)
  return Math.floor(n * p + 1e-9) / p
}

/** 数量显示:按单位精度格式化并去掉尾随 0(5000 → "5000";304.6 → "304.6") */
export function formatQtyByUnit(value, decimals) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value ?? '')
  const nd = Math.max(0, Math.min(4, Math.trunc(Number(decimals) || 0)))
  return String(Number(n.toFixed(nd)))
}
