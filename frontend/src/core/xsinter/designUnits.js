/**
 * designUnits.js —— X烧结「设计添加量」的单位换算（纯函数，无 Vue/无 IO）  2026-10-30
 *
 * 【为什么需要这一层】2026-10-30 用户报障：
 *   「新的面板的配方计算器没有默认百分比%，填数字会超过1，计算异常」
 *   —— 弹窗那格原来把输入原样喂给引擎，而引擎里的比例是**小数**（0.45 = 45%）。
 *      人手填「45」被当成 4500%，比例合计 55 → 粉料1 倒推成 −54，整张表算出负数。
 *
 * 【口径照抄烧结工艺清单，不另立一套】
 *   `core/mold/recipeSheet.js` 的 `parseRatio` 早就是这个容错口径（那边跑了一年多）：
 *     带 `%` ⇒ 按百分数；无 `%` 且 > 1 ⇒ 按百分数（'45' = 45%）；其余原样（'0.45' = 45%）。
 *   两套计算器读的是同一种「设计添加量」文本，**必须同一个解释**，否则同一袋料在两张单上
 *   算出的比例不一样。故这里直接复用，不复制第二份。
 *
 * 【颗粒料是唯一的例外：它是**克数**，不是比例】
 *   Excel E16:E18 → F16:F18 直接等值进单支总重，所以颗粒料行填「2」就是 2 克，
 *   绝不能走百分数解释（否则 2 克会被当成 2%）。`isGramRow` 就是这条分界线。
 */

import { parseRatio } from '../mold/recipeSheet.js'

const r6 = (x) => Math.round(x * 1e6) / 1e6

/** 该料位按**克数**录入（颗粒料1~3）；其余（粉料1~5 / 胶粉1~2）按**比例** */
export function isGramRow(kind) {
  return String(kind ?? '').includes('颗粒料')
}

/** 设计添加量文本 → 引擎要的比例（粉料/胶粉行）；空/脏值 → 0 */
export function ratioOfDesign(text) {
  return parseRatio(text)?.value ?? 0
}

/** 设计添加量文本 → 克数（颗粒料行）；空/脏值 → 0 */
export function gramsOfDesign(text) {
  const raw = String(text ?? '').replace('%', '').replace(/,/g, '').trim()
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/**
 * 弹窗那 10 行 → 引擎入参 `designs`。
 * 粉料/胶粉转成比例（0.45），颗粒料保留克数（2）；粉料1 那格传什么都不影响结果（引擎倒推）。
 */
export function engineDesignsOf(lines) {
  const list = Array.isArray(lines) ? lines : []
  return list.map((r) => (isGramRow(r?.kind) ? gramsOfDesign(r?.design) : ratioOfDesign(r?.design)))
}

/** 比例 → 纸面/表格上的百分数（0.265 → 26.5）；给显示与落库共用，避免两处各自 ×100 */
export function percentOf(ratio) {
  const n = Number(ratio)
  return Number.isFinite(n) ? r6(n * 100) : 0
}
