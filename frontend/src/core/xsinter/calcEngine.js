/**
 * calcEngine.js —— X烧结配方工艺管控清单的**配方计算引擎**（纯函数，无 Vue/无 IO）  2026-10-30
 *
 * 【设计依据】
 *   《X烧结工单模板-261029.xlsx》sheet「配方计算器」（公式 100% 来自该表），
 *   真实单据 T205-X冰箱炭棒-26102901.xlsx 作为验收基准（见 calcEngine.test.js）。
 *
 * 【为什么不复用 core/mold/recipeEngine.js】
 *   那个引擎是《炭棒工艺配方设计器》exe 的逐位复刻（一切几 / 折算比 / 脱模上下限漂移系数），
 *   公式体系与 X烧结这张表**不同**：X烧结用「圆柱体积 × 密度」直接推单支重量，
 *   并有「粉料1 由 1 倒推」「颗粒料按克数直接计入（不乘单支重量）」两条特殊规则。
 *   混用会算错数，且历史单据无法回溯 —— 故独立成模块。
 *
 * 【计算顺序（照 Excel 的依赖链，不能颠倒）】
 *   ① 切割长度中间值 = 出货长度 + 成型修正长度参数
 *   ② 炭棒体积 = (外径² − 内径²)/4000 × π × 切割长度中间值      ← 单位 cm³
 *   ③ 单支重量三档 = 体积 × 密度（下限 / 中值 / 上限）
 *   ④ 粉料1 的设计添加量 = 1 − Σ(粉料2..5 + 胶粉1..2)              ← **倒推**，不是手填
 *   ⑤ 折算物料重量 = 颗粒物料折算系数 × Σ(颗粒料1..3)
 *   ⑥ 单支总重 = 单支重量中间值×Σ(粉料1..5) − 折算物料重量
 *                + 中间值×(胶粉1+胶粉2) + Σ(颗粒料1..3 的克数)
 *      —— 粉料与胶粉是**比例**（×中间值），颗粒料是**克数**（直接加），这是 Excel 里
 *         F9 一条公式覆盖粉料1-5、而 F16-18 直接取 E16-18 的原因。
 *   ⑦ 各物料单支含量 = 该物料实际比例 × 单支总重
 *
 * 【与单据字段的对应】
 *   切炭长度  → 切炭长度下限/中间值/上限mm
 *   冷却长度  → 冷却长度下限/中间值/上限mm   （= 切炭三档 − 成型修正长度参数）
 *   炭棒重量  → 炭棒重量下限/中间值/上限g
 *   密度要求  → 密度要求下限/中间值/上限      （= 密度参数下限 / 中值 / 上限）
 *   配方表    → 添加比例（实际比例）/ 单支含量g
 */

/** Excel 的物料行顺序，固定 10 行 —— 下标即明细「序号」1..10。 */
export const ROW_KINDS = Object.freeze([
  '粉料1', '粉料2', '粉料3', '粉料4', '粉料5',
  '胶粉1', '胶粉2',
  '颗粒料1', '颗粒料2', '颗粒料3',
])

/** 哪几行是「按克数直接计入」的颗粒料（Excel E16:E18 → F16:F18 直接等值）。 */
const GRANULE_FROM = 7   // ROW_KINDS 下标 7..9 = 颗粒料1..3

export const XSINTER_PI = 3.14   // Excel 写的是 3.14（不是 Math.PI），必须逐位一致

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}
const r6 = (x) => Math.round(x * 1e6) / 1e6

/**
 * @param {object} input
 *   rodOuter / rodInner / shipLength   炭棒外径 / 内径 / 出货长度（mm）
 *   dieOutlet / rodDiameter            模具出料口内径 / 中心杆外径（mm，仅回填，不参与公式）
 *   granuleFactor                      颗粒物料折算系数（Excel H6，默认 0.65）
 *   lengthFix                          成型修正长度参数mm（Excel I6，默认 0.5）
 *   densLow / densHigh                 密度参数下限/上限（Excel J6/K6，默认 0.55/0.64）
 *   designs                            长度 10 的数组：各物料「设计添加量」
 *                                      （粉料1 那格会被倒推覆盖，传什么都以结果为准）
 * @returns 计算结果；所有数值保留 6 位小数（与 Excel 缓存值的精度一致）
 */
export function computeXsinter(input = {}) {
  const rodOuter = num(input.rodOuter)
  const rodInner = num(input.rodInner)
  const shipLength = num(input.shipLength)
  const granuleFactor = num(input.granuleFactor)
  const lengthFix = num(input.lengthFix)
  const densLow = num(input.densLow)
  const densHigh = num(input.densHigh)

  const designs = Array.from({ length: ROW_KINDS.length }, (_, i) => num(input.designs?.[i]))

  // ① 切割长度中间值（Excel J8 = G6 + I6，G6 = G4 出货长度）
  const cutMid = shipLength + lengthFix

  // ② 炭棒体积（Excel K8 = ((E6^2 - F6^2)/4000)*3.14*J8）
  const volume = ((rodOuter * rodOuter - rodInner * rodInner) / 4000) * XSINTER_PI * cutMid

  // ③ 单支重量三档（Excel I10 / J10 / K10）
  const densMid = (densLow + densHigh) / 2
  const weightLow = volume * densLow
  const weightMid = volume * densMid
  const weightHigh = volume * densHigh

  // ④ 粉料1 倒推（Excel E9 = 1 - SUM(E10:E15)）：粉料2..5 + 胶粉1..2
  const restPowder = designs.slice(1, 7).reduce((a, b) => a + b, 0)
  designs[0] = 1 - restPowder

  // ⑤ 折算物料重量（Excel I8 = H6*SUM(E16:E18)）：颗粒料1..3
  const granuleSum = designs.slice(GRANULE_FROM).reduce((a, b) => a + b, 0)
  const convWeight = granuleFactor * granuleSum

  // ⑥ 单支总重（Excel F19 = SUM(F9:F18)）
  //    粉料1..5 合计 = 中间值 × Σ(E9:E13) − 折算物料重量   （Excel F9 一条公式覆盖 5 行）
  //    胶粉1..2      = 中间值 × 比例
  //    颗粒料1..3    = 克数直接计入
  const powderSum = designs.slice(0, 5).reduce((a, b) => a + b, 0)
  const glueSum = designs[5] + designs[6]
  const totalWeight = weightMid * powderSum - convWeight
    + weightMid * glueSum
    + designs.slice(GRANULE_FROM).reduce((a, b) => a + b, 0)

  // ⑦ 每行的实际比例与单支含量
  //    G 列 = 设计添加量（粉料1 用倒推值）；G 列再倒推一次 H9 = G9*F19 已在下面统一处理
  const actual = designs.map((d) => r6(d))
  const perPiece = actual.map((g) => r6(g * totalWeight))

  const rows = ROW_KINDS.map((kind, i) => ({
    kind,
    design: r6(designs[i]),
    actual: actual[i],
    perPiece: perPiece[i],
  }))

  return {
    /* 中间量（界面上「计算过程」区展示，纸面不印） */
    cutMid: r6(cutMid),
    volume: r6(volume),
    convWeight: r6(convWeight),
    /* 单支总重与比例合计（Excel F19 / G19，正常应分别为 >0 与 1） */
    totalWeight: r6(totalWeight),
    totalRatio: r6(actual.reduce((a, b) => a + b, 0)),
    /* 纸面「成型管控要求」五段 */
    cut: { low: r6(cutMid - lengthFix), mid: r6(cutMid), high: r6(cutMid + lengthFix) },
    cool: { low: r6(cutMid - 2 * lengthFix), mid: r6(cutMid - lengthFix), high: r6(cutMid) },
    weight: { low: r6(weightLow), mid: r6(weightMid), high: r6(weightHigh) },
    density: { low: r6(densLow), mid: r6(densMid), high: r6(densHigh) },
    rows,
  }
}

/**
 * 输入的**可计算性**检查（界面用来决定「填入单据」是否可点、并给出人话原因）。
 * 只查"算不出来"的硬条件，不替用户做业务判断。
 * @returns {string[]} 问题清单；空数组 = 可计算
 */
export function problemsOf(input = {}) {
  const out = []
  const o = num(input.rodOuter)
  const i = num(input.rodInner)
  if (!o) out.push('炭棒外径未填')
  if (!i) out.push('炭棒内径未填')
  if (o && i && o <= i) out.push('炭棒外径必须大于内径')
  if (!num(input.shipLength)) out.push('炭棒出货长度未填')
  const dLow = num(input.densLow)
  const dHigh = num(input.densHigh)
  if (!dLow || !dHigh) out.push('密度参数上下限未填')
  if (dLow && dHigh && dLow > dHigh) out.push('密度参数下限不能大于上限')

  const designs = Array.isArray(input.designs) ? input.designs : []
  const rest = designs.slice(1, 7).reduce((a, b) => a + num(b), 0)
  // 提示里说**百分数**（人填的是百分数，说"超过 1"没人看得懂 1 是什么单位）
  if (rest > 1) out.push(`粉料2~5 与胶粉1~2 的比例合计 ${r6(rest * 100)}% 超过 100%，粉料1 会倒推成负数`)
  if (rest <= 0) out.push('至少填一个粉料或胶粉的设计添加量')
  return out
}
