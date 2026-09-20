/**
 * 配方计算引擎 —— 炭棒配方 12 步计算的**唯一实现**(前端)。
 *
 * 真源 =《炭棒工艺配方设计器》exe 的 `app.domain.engine.compute`(ENGINE_VERSION 1.0.0)。
 * 本文件是把那份 Python 逐条搬过来的:**表达式次序、运算结合性、缺省兜底、告警文案都与它对齐**,
 * 因为验收口径是"与 exe 逐位一致"(浮点同一个 double 才敢用 === 比),不是"看起来对"。
 * 期望值由 `tools/archive/_gen-recipe-golden.py` 从 exe 真引擎产出,固化为 __fixtures__/。
 *
 * 单位口径(容易踩,写在最前面):
 *   - 粉料/胶粉料位传 `design_ratio` = **小数**(0.62 表示 62%),不是百分数;
 *   - 折算料料位传 `amount_g` = **克/支**(引擎自己乘腔数);
 *   - `moisture` = 小数(0.06 表示 6%),null/''/缺键都按"未采集"处理并告警。
 *
 * 与 Python 的两处有意差异(都只影响错误路径,不影响任何正常输入的结果):
 *   ① 配方不是恰好 10 个料位 → 明确报错(Python 会 IndexError);
 *   ② 必填参数缺失/非数字 → 明确报错(Python 会 KeyError/ValueError)。
 *   原因是弹窗里的输入来自单据与手填,"静默算成 NaN"比"报错"危险得多。
 */
import {
  PI, VOLUME_DIVISOR, BLANK_LENGTH_BASE, BLANK_LENGTH_PER_CAVITY, DEFAULT_LENGTH_TOL,
  DEFAULT_DEMOLD_LOW_FACTOR, DEFAULT_DEMOLD_HIGH_FACTOR, POWDER_SLOTS, GLUE_SLOTS,
  CONVERTED_SLOTS, CONVERSION_RATIO_MIN, CONVERSION_RATIO_MAX, STRATEGY_LEGACY, SLOT_COUNT,
} from './recipeConstants.js'

/** 必填参数:缺失或非有限数就报错(对齐 Python 的 float(params['x']) 会炸的语义) */
function need(params, key) {
  const raw = params[key]
  if (raw === undefined || raw === null) throw new Error(`配方计算缺少必填参数:${key}`)
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`配方计算参数 ${key} 不是数字:${raw}`)
  return value
}

/** 可选参数:缺键取默认值,但**取到 null 也报错**(对齐 Python 的 float(None) 会炸) */
function optionalNum(params, key, fallback) {
  const raw = params[key] !== undefined ? params[key] : fallback
  return need({ [key]: raw }, key)
}

/** Python `x or 0` 再 float():None/''/0/False 都归零,其余按数取 */
const pyOrZero = (v) => (v === undefined || v === null || v === '' || v === 0 || v === false ? 0 : Number(v))

/** Python `sum(list)`:从 0 起左到右累加(Python 3.10 是朴素求和,3.12 起改补偿求和,别用新版本生成黄金向量) */
function sumList(list) {
  let total = 0
  for (const v of list) total += v
  return total
}

/**
 * 计算配方结果。
 *
 * @param {object} params {od, id, length(炭棒长度mm), cavities(一切几), density_low, density_high,
 *                          conversion_ratio(折算比), length_tol_low/length_tol_high(成型长度公差,
 *                          老键 length_tol 兜底,默认 2.5), demold_low_factor/demold_high_factor(默认 1.0)}
 * @param {Array} recipe 10 个料位:粉料/胶粉位给 design_ratio(小数),折算料位给 amount_g(克/支),
 *                       每位可给 moisture(小数,null/'' 按未采集)
 * @returns {object} 全量中间结果(12 步逐条对应,供弹窗预览与回填)
 */
export function compute(params, recipe) {
  if (!Array.isArray(recipe) || recipe.length !== SLOT_COUNT) {
    throw new Error(`配方必须恰好 ${SLOT_COUNT} 个料位,当前 ${Array.isArray(recipe) ? recipe.length : 0} 个`)
  }

  const warnings = []
  const od = need(params, 'od')
  const id_ = need(params, 'id')
  const length = need(params, 'length')
  const n = Math.trunc(need(params, 'cavities'))
  const densityLow = need(params, 'density_low')
  const densityHigh = need(params, 'density_high')
  const conversionRatio = need(params, 'conversion_ratio')
  // 老键 length_tol 兜底(单据历史 payload 用过单值公差)
  const tolPick = (key) => (params[key] !== undefined ? params[key]
    : (params.length_tol !== undefined ? params.length_tol : DEFAULT_LENGTH_TOL))
  const lengthTolLow = need({ length_tol_low: tolPick('length_tol_low') }, 'length_tol_low')
  const lengthTolHigh = need({ length_tol_high: tolPick('length_tol_high') }, 'length_tol_high')
  const demoldLowFactor = optionalNum(params, 'demold_low_factor', DEFAULT_DEMOLD_LOW_FACTOR)
  const demoldHighFactor = optionalNum(params, 'demold_high_factor', DEFAULT_DEMOLD_HIGH_FACTOR)

  if (densityLow > densityHigh) warnings.push('密度下限大于上限，请检查密度管控范围')
  if (!(CONVERSION_RATIO_MIN <= conversionRatio && conversionRatio <= CONVERSION_RATIO_MAX)) {
    warnings.push('折算比应在 0~1 之间')
  }

  // ── 第 1~3 步:成型长度三值与体积 ──
  const lengthStd = length * n + (BLANK_LENGTH_BASE + n * BLANK_LENGTH_PER_CAVITY)
  const lengthLow = lengthStd - lengthTolLow
  const lengthHigh = lengthStd + lengthTolHigh

  const k = (od * od - id_ * id_) / VOLUME_DIVISOR * PI
  const volLow = k * lengthLow
  const volStd = k * lengthStd
  const volHigh = k * lengthHigh

  // ── 第 4~5 步:干重与折算炭粉量 ──
  const densityMid = (densityLow + densityHigh) / 2
  const dryUnconverted = volStd * densityMid

  const convAmounts = CONVERTED_SLOTS.map((i) => pyOrZero(recipe[i].amount_g) * n)
  const gramSum = sumList(convAmounts)
  const convertedCarbon = gramSum * conversionRatio

  const dryLow = volHigh * densityLow - convertedCarbon + gramSum
  const dryStd = volStd * densityMid - convertedCarbon + gramSum
  const dryHigh = volLow * densityHigh - convertedCarbon + gramSum

  // ── 第 6 步:脱模重量(漂移系数) ──
  const demoldLow = dryLow * demoldLowFactor
  const demoldHigh = dryHigh * demoldHighFactor
  const demoldMid = (demoldLow + demoldHigh) / 2

  // ── 第 7~8 步:设计比例合计与粉料块 ──
  const powderRatios = POWDER_SLOTS.map((i) => pyOrZero(recipe[i].design_ratio))
  const glueRatios = GLUE_SLOTS.map((i) => pyOrZero(recipe[i].design_ratio))
  const powderRatioSum = sumList(powderRatios)
  const glueRatioSum = sumList(glueRatios)
  const totalDesign = powderRatioSum + glueRatioSum
  if (Math.abs(totalDesign - 1.0) > 1e-6) {
    warnings.push(`1~7 位设计比例合计为 ${totalDesign.toFixed(4)} ≠ 1，请检查配方配平`)
  }

  const powderBlockUnconverted = dryUnconverted * powderRatioSum
  const powderBlockConverted = powderBlockUnconverted - convertedCarbon
  const glueAmounts = glueRatios.map((r) => r * dryUnconverted)
  const glueSum = sumList(glueAmounts)
  const total = powderBlockConverted + glueSum + gramSum

  // ── 第 9~10 步:最终比例(料位1 补差)与单支克重 ──
  const finalRatios = new Array(SLOT_COUNT).fill(0)
  POWDER_SLOTS.slice(1).forEach((i) => { finalRatios[i] = powderRatios[i] })
  GLUE_SLOTS.forEach((i, idx) => { finalRatios[i] = total ? glueAmounts[idx] / total : 0.0 })
  CONVERTED_SLOTS.forEach((i, idx) => { finalRatios[i] = total ? convAmounts[idx] / total : 0.0 })
  finalRatios[0] = 1.0 - sumList(finalRatios.slice(1))
  if (finalRatios[0] < 0) warnings.push('料位 1 添加比例为负（折算料投加量超过总量），请复核折算料用量')

  const finalAmounts = finalRatios.map((r) => r * total)

  // ── 第 11 步:含水分添加量(只有粉料位按含水率反算) ──
  const wetAmounts = []
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const item = recipe[i]
    let moisture = item.moisture === undefined ? null : item.moisture
    let wet
    if (POWDER_SLOTS.includes(i)) {
      if (moisture === null || moisture === '') {
        warnings.push(`料位 ${i + 1} 水分未采集，按 0 计，请补充含水率`)
        moisture = 0.0
      }
      moisture = Number(moisture)
      const dryFactor = 1 - moisture
      wet = dryFactor !== 0 ? finalAmounts[i] / dryFactor : finalAmounts[i]
    } else {
      wet = finalAmounts[i]
    }
    wetAmounts.push(wet)
  }

  // ── 第 12 步:理论水分(物料平均水分)与混合料水分参考 ──
  const moistValues = POWDER_SLOTS.map((i) => {
    const m = recipe[i].moisture
    return (m === null || m === undefined || m === '') ? 0.0 : Number(m)
  })

  const numeratorPm = sumList(POWDER_SLOTS.map((i) => powderRatios[i] * moistValues[i]))
  const denominatorPm = totalDesign
  const powderAvgMoisture = denominatorPm ? numeratorPm / denominatorPm : 0.0

  const numeratorMm = sumList(POWDER_SLOTS.map((i) => wetAmounts[i] * moistValues[i]))
  const denominatorMm = sumList(POWDER_SLOTS.map((i) => wetAmounts[i]))
  const mixedMoisture = denominatorMm ? numeratorMm / denominatorMm : 0.0

  /** 灌料湿重 = 干重 /(1 − 物料平均水分) */
  const pour = (dry) => {
    const dryFactor = 1 - powderAvgMoisture
    return dryFactor ? dry / dryFactor : dry
  }
  const pourLow = pour(dryLow)
  const pourStd = pour(dryStd)
  const pourHigh = pour(dryHigh)
  const actualMoisture = pourStd ? 1 - demoldMid / pourStd : 0.0

  return {
    strategy: STRATEGY_LEGACY,
    warnings,
    params: {
      od,
      id: id_,
      length,
      cavities: n,
      density_low: densityLow,
      density_high: densityHigh,
      density_mid: densityMid,
      conversion_ratio: conversionRatio,
      length_tol_low: lengthTolLow,
      length_tol_high: lengthTolHigh,
      demold_low_factor: demoldLowFactor,
      demold_high_factor: demoldHighFactor,
    },
    lengths: { low: lengthLow, std: lengthStd, high: lengthHigh },
    k,
    volumes: { low: volLow, std: volStd, high: volHigh },
    dry_unconverted: dryUnconverted,
    conv_amounts: convAmounts,
    gram_sum: gramSum,
    converted_carbon: convertedCarbon,
    dry_weights: { low: dryLow, std: dryStd, high: dryHigh },
    demold: { low: demoldLow, mid: demoldMid, high: demoldHigh },
    powder_ratio_sum: powderRatioSum,
    powder_block_unconverted: powderBlockUnconverted,
    powder_block_converted: powderBlockConverted,
    glue_amounts: glueAmounts,
    glue_sum: glueSum,
    total,
    final_ratios: finalRatios,
    final_amounts: finalAmounts,
    wet_amounts: wetAmounts,
    moisture: { powder_avg: powderAvgMoisture, mixed: mixedMoisture },
    pour_weights: { low: pourLow, std: pourStd, high: pourHigh },
    actual_moisture: actualMoisture,
  }
}
