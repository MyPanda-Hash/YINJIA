/**
 * 配方表 ⇄ 计算引擎的接线逻辑(纯函数,不碰 Vue)。
 *
 * 三件事:
 *   ① `slotsFromRows`  单据页 2「配方表」的行 → 引擎的 10 个料位
 *   ② `paramsFromHead` 单据头字段 + 参数集 → 引擎入参
 *   ③ `buildPatch`     引擎结果 → 回填补丁(页 1 十一个格 + 配方表两列)
 *
 * 单位与口径(与 recipeEngine 的头注一致,这里再钉一次):
 *   - 粉料/胶粉行的「设计添加量」= **比例**。单据上人可能填小数(0.62)也可能填百分数(62),
 *     故 `parseRatio` 做容错解释并对"按百分数解释"标记出来,弹窗会把它显示给用户看;
 *   - 折算料行的「设计添加量」= **克/支**(引擎自己乘腔数),若直接当比例会算出荒谬的料位1 补差;
 *   - 料位 1 恒为**补差位**(= 1 − Σ料位2~7),与演示程序一致 —— 单据上第 1 行填的值不参与计算,
 *     弹窗把它显示为只读并标注来源。
 *
 * 已知局限(写下来而不是装作没有):
 *   料位分组按「物料种类」判定(与演示程序的料位可选物料一致)。若有人把「功能料-粉末」的物料
 *   当成折算料填在第 8~10 行,它会被分到粉料位、结果就错了。弹窗会显示每个料位的实际分组,
 *   且粉料超过 5 行会告警 —— 但根子上要靠"物料种类填对"或后续加一列显式料位号来根治。
 */
import { SLOT_COUNT, POWDER_SLOTS, GLUE_SLOTS, CONVERTED_SLOTS, DEFAULT_LENGTH_TOL } from './recipeConstants.js'

export const SLOT_GROUPS = { POWDER: '粉料', GLUE: '胶粉', CONVERTED: '折算料' }

/** 物料种类 → 料位分组(与演示程序 料位↔可选物料 的对应关系一致) */
export function groupOfMaterialType(type) {
  const t = String(type ?? '').trim()
  if (!t) return ''
  if (t.includes('胶粉')) return SLOT_GROUPS.GLUE
  if (t.includes('颗粒') || t.includes('折算物料')) return SLOT_GROUPS.CONVERTED
  if (t.includes('炭粉') || t.includes('粉末')) return SLOT_GROUPS.POWDER
  return ''
}

/** 「设计添加量」→ 比例:小数原样,'62'/'62%' 按百分数解释(并标记,弹窗要提示) */
export function parseRatio(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const explicitPercent = raw.includes('%')
  const num = Number(raw.replace('%', '').trim())
  if (!Number.isFinite(num)) return null
  if (explicitPercent) return { value: num / 100, percentAssumed: false }
  if (num > 1) return { value: num / 100, percentAssumed: true }
  return { value: num, percentAssumed: false }
}

/** 数值文本(折算料的克/支) */
function parseNumber(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const num = Number(raw.replace('%', '').trim())
  return Number.isFinite(num) ? num : null
}

/** 「密度范围：0.56~0.58」这类文本 → [下限, 上限] */
export function parseDensityRange(text) {
  const raw = String(text ?? '')
  const m = raw.match(/(\d+(?:\.\d+)?)\s*[~～\-—至]\s*(\d+(?:\.\d+)?)/)
  if (!m) return null
  const low = Number(m[1])
  const high = Number(m[2])
  return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
}

/**
 * 配方表的行 → 10 个料位。
 * @returns {{slots: Array, warnings: string[]}} slots 恒为 10 个(不足补空位),每个含
 *   {slot, group, code, name, designRatio, amountG, moisture, rowIndex, derived, issue}
 */
export function slotsFromRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const warnings = []
  const buckets = { [SLOT_GROUPS.POWDER]: [], [SLOT_GROUPS.GLUE]: [], [SLOT_GROUPS.CONVERTED]: [] }
  const capacity = { [SLOT_GROUPS.POWDER]: POWDER_SLOTS.length, [SLOT_GROUPS.GLUE]: GLUE_SLOTS.length, [SLOT_GROUPS.CONVERTED]: CONVERTED_SLOTS.length }

  list.forEach((r, rowIndex) => {
    const kind = r?.['物料种类']
    const group = groupOfMaterialType(kind)
    const name = r?.['物料名称'] || r?.['物料编号'] || ''
    if (!group) {
      warnings.push(`第 ${rowIndex + 1} 行「${name || '未填物料'}」的物料种类「${kind ?? ''}」认不出来，暂按粉料处理，请核对物料档案的物料种类`)
      buckets[SLOT_GROUPS.POWDER].push({ rowIndex, row: r, issue: 'unknown-type' })
      return
    }
    if (buckets[group].length >= capacity[group]) {
      warnings.push(`${group}料位最多 ${capacity[group]} 个，第 ${rowIndex + 1} 行已忽略（请合并或调整配方行）`)
      return
    }
    buckets[group].push({ rowIndex, row: r })
  })

  const slots = []
  const push = (group, slotNo, entry) => {
    const r = entry?.row
    const designText = r?.['设计添加量']
    const isConverted = group === SLOT_GROUPS.CONVERTED
    const parsed = parseRatio(designText)
    if (parsed?.percentAssumed) {
      warnings.push(`料位 ${slotNo} 的「设计添加量」填的是 ${String(designText).trim()}，已按百分数解释为 ${(parsed.value * 100).toFixed(2)}%`)
    }
    slots.push({
      slot: slotNo,
      group,
      code: r?.['物料编号'] || '',
      name: r?.['物料名称'] || '',
      designRatio: isConverted ? null : (parsed ? parsed.value : (r ? 0 : null)),
      amountG: isConverted ? (parseNumber(designText) ?? 0) : null,
      moisture: null,
      rowIndex: entry ? entry.rowIndex : -1,
      derived: slotNo === 1,
      issue: entry?.issue || '',
    })
  }

  POWDER_SLOTS.forEach((_, i) => push(SLOT_GROUPS.POWDER, i + 1, buckets[SLOT_GROUPS.POWDER][i]))
  GLUE_SLOTS.forEach((_, i) => push(SLOT_GROUPS.GLUE, i + 6, buckets[SLOT_GROUPS.GLUE][i]))
  CONVERTED_SLOTS.forEach((_, i) => push(SLOT_GROUPS.CONVERTED, i + 8, buckets[SLOT_GROUPS.CONVERTED][i]))

  // 料位 1 恒为补差位:1 − Σ(料位2~7)
  const others = slots.filter((s) => s.slot >= 2 && s.slot <= 7).reduce((sum, s) => sum + (s.designRatio || 0), 0)
  slots[0].designRatio = 1 - others
  if (slots[0].designRatio < 0) {
    warnings.push(`料位 1 的补差比例算出来是负的（${(slots[0].designRatio * 100).toFixed(2)}%），说明料位 2~7 的比例合计已超过 100%，请核对设计添加量`)
  }
  return { slots, warnings }
}

/** 引擎入参:尺寸/密度读单据,工艺参数来自参数集(弹窗传入) */
export function paramsFromHead(head, overrides = {}) {
  const h = head || {}
  const pick = (...keys) => {
    for (const k of keys) {
      const v = parseNumber(h[k])
      if (v !== null) return v
    }
    return null
  }
  const od = pick('炭棒规格1', '外径mm')
  const id = pick('炭棒规格2', '内径mm')
  const length = pick('炭棒规格3')
  let densityLow = pick('实际密度管控下限')
  let densityHigh = pick('实际密度管控上限')
  if (densityLow === null || densityHigh === null) {
    const range = parseDensityRange(h['密度管控要求'])
    if (range) {
      if (densityLow === null) densityLow = range[0]
      if (densityHigh === null) densityHigh = range[1]
    }
  }

  const missing = []
  if (od === null) missing.push('外径')
  if (id === null) missing.push('内径')
  if (length === null) missing.push('长度')
  if (densityLow === null) missing.push('密度下限')
  if (densityHigh === null) missing.push('密度上限')

  const params = {
    od,
    id,
    length,
    cavities: Number(overrides.cavities ?? 1),
    density_low: densityLow,
    density_high: densityHigh,
    conversion_ratio: Number(overrides.conversion_ratio ?? 0.5),
    length_tol_low: Number(overrides.length_tol_low ?? DEFAULT_LENGTH_TOL),
    length_tol_high: Number(overrides.length_tol_high ?? DEFAULT_LENGTH_TOL),
    demold_low_factor: Number(overrides.demold_low_factor ?? 1),
    demold_high_factor: Number(overrides.demold_high_factor ?? 1),
  }
  return { params, missing }
}

/** 位数口径(照《炭棒BOM及工艺信息表单需求设计内容》):灌料/脱模/长度 1 位,水分 2 位,比例 2 位带 % */
const fixed = (x, digits) => (Number.isFinite(x) ? x.toFixed(digits) : '')

/** 引擎结果 → 回填补丁(只含有行或有值的料位;空料位不产生行补丁) */
export function buildPatch(result, slots) {
  const p = result.params
  const head = {
    理论最低灌料重量g: fixed(result.pour_weights.low, 1),
    理论灌料中间值g: fixed(result.pour_weights.std, 1),
    理论最高灌料重量g: fixed(result.pour_weights.high, 1),
    理论水分: fixed(result.moisture.powder_avg * 100, 2),
    最短长度mm: fixed(result.lengths.low, 1),
    中间值mm: fixed(result.lengths.std, 1),
    最长长度mm: fixed(result.lengths.high, 1),
    最低重量g: fixed(result.demold.low, 1),
    中间值g: fixed(result.demold.mid, 1),
    最高重量g: fixed(result.demold.high, 1),
    实际密度管控下限: fixed(p.density_low, 2),
    实际密度管控上限: fixed(p.density_high, 2),
  }
  const rows = []
  slots.forEach((s, i) => {
    if (s.rowIndex < 0) return
    rows.push({
      rowIndex: s.rowIndex,
      code: s.code,
      实际添加比例: `${fixed(result.final_ratios[i] * 100, 2)}%`,
      单支物料含量: fixed(result.final_amounts[i], 2),
    })
  })
  return { head, rows }
}

/** 给引擎的料位数组(顺便把空料位补成合法对象) */
export function toEngineRecipe(slots) {
  const list = slots.slice(0, SLOT_COUNT)
  while (list.length < SLOT_COUNT) {
    list.push({ slot: list.length + 1, group: '', code: '', name: '', designRatio: 0, amountG: 0, moisture: null, rowIndex: -1 })
  }
  return list.map((s) => ({
    design_ratio: s.designRatio,
    amount_g: s.amountG,
    moisture: s.moisture,
  }))
}
