/**
 * 明细→合计 的求和口径(2026-10-03 用户报:「单据明细与合计的小数点后位数有差距,要合计保持与明细一致」)。
 *
 * 背景(实查得出,别退回旧写法):
 *  · 合计原先一律写成 `Math.round(sum * 100) / 100`(硬编码 2 位),而单据明细列在库里
 *    绝大多数是 `decimal(18,4)`(HSDZ_MES 实测:scale=4 共 291 列,scale=2 仅 11 列,scale=6 有 8 列)
 *    ⇒ 明细显示 `1.2345`,合计却显示 `1.23`,同一列两套位数。
 *  · 反向问题同样存在:汇总页签的分组小计没做任何收敛,`1.1 + 2.2` 会显示成 `3.3000000000000003`,
 *    而同一张表的合计行是 `3.3` —— 也是"位数不一致"。
 *
 * 口径(单一真源,所有合计都走这里):
 *  · 合计保留的小数位 = **参与求和的明细值里最多的小数位**(整数就 0 位,最多 maxScale 位),
 *    即"合计的位数永远不比自己那一列的明细少";
 *  · 末位按十进制四舍五入收一次,顺带吃掉浮点尾差(0.1+0.2 → 0.3 而不是 0.30000000000000004)。
 *
 * 注意:这里只治"显示口径",**不改业务数值** —— 落库值仍由后端 CalcRuleService /
 * 各生单 Handler 按自己的 round 规则算(frontend/src/core/panel/calcRules.js 与之后端逐位一致)。
 */

/** 默认最多保留 10 位(库内实际最大 scale=6;给足余量又不至于把浮点噪声当成"位数") */
export const MAX_TOTAL_SCALE = 10

/**
 * 数值的十进制小数位数(按字面量数,不按二进制展开)。
 * @param {unknown} value 任意值(字符串/数字都认;非数值返回 0)
 * @returns {number} 小数位数,如 1.2345 → 4;/1e-7 → 7;/3 → 0
 */
export function decimalsOf(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const s = String(n)
  const e = s.search(/[eE]/)
  if (e < 0) {
    const dot = s.indexOf('.')
    return dot < 0 ? 0 : s.length - dot - 1
  }
  const mantissa = s.slice(0, e)
  const exp = Number(s.slice(e + 1))
  const dot = mantissa.indexOf('.')
  const mantissaDecimals = dot < 0 ? 0 : mantissa.length - dot - 1
  return Math.max(0, mantissaDecimals - (Number.isFinite(exp) ? exp : 0))
}

/** 空单元格(没填 ≠ 填了 0):null / undefined / 空串(含纯空白)都不算一项 */
function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

/**
 * 「合计」求和:位数跟明细走。
 * @param {Iterable<unknown>} values 明细值(空单元格与非数值项直接跳过)
 * @param {{ maxScale?: number }} [opts] 位数上限(默认 {@link MAX_TOTAL_SCALE})
 * @returns {number|null} 合计值;**没有任何可加项时返回 null**(由调用方决定显示 '' 还是 0)
 */
export function sumKeepScale(values, opts = {}) {
  if (!values) return null
  const nums = []
  for (const v of values) {
    if (isBlank(v)) continue
    const n = Number(v)
    if (Number.isFinite(n)) nums.push(n)
  }
  if (!nums.length) return null
  const cap = Number.isFinite(opts.maxScale) && opts.maxScale >= 0 ? Math.floor(opts.maxScale) : MAX_TOTAL_SCALE
  let scale = 0
  for (const n of nums) scale = Math.max(scale, decimalsOf(n))
  scale = Math.min(scale, cap)
  // toFixed 按十进制四舍五入,同时抹掉累加产生的浮点尾差;scale=0 时给整数
  const sum = nums.reduce((a, b) => a + b, 0)
  return Number(sum.toFixed(scale))
}

/**
 * 便捷包装:取行数组某一列的合计(列键=明细行键,永远是中文字段名,ADR-0001)。
 * @param {Array<object>} rows 明细行
 * @param {string} key 列键
 * @returns {number|null} 见 {@link sumKeepScale}
 */
export function sumColumn(rows, key, opts) {
  return sumKeepScale((rows || []).map((r) => r?.[key]), opts)
}
